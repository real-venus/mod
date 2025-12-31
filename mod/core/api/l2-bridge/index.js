const express = require('express');
const { create } = require('ipfs-http-client');
const axios = require('axios');
const { Pool } = require('pg');
const { MerkleTree } = require('merkletreejs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// IPFS client
const ipfs = create({ url: process.env.IPFS_API || 'http://localhost:5001' });

// PostgreSQL client
const pool = new Pool({
  host: 'postgres',
  database: process.env.POSTGRES_DB || 'zcash_l2',
  user: process.env.POSTGRES_USER || 'l2user',
  password: process.env.POSTGRES_PASSWORD || 'l2pass',
  port: 5432,
});

// Zcash RPC client
const zcashRPC = async (method, params = []) => {
  const response = await axios.post(
    process.env.ZCASH_RPC || 'http://localhost:8232',
    {
      jsonrpc: '1.0',
      id: 'l2-bridge',
      method,
      params,
    },
    {
      auth: {
        username: process.env.ZCASH_USER || 'zcashrpc',
        password: process.env.ZCASH_PASSWORD || 'changeme',
      },
    }
  );
  return response.data.result;
};

// Initialize database
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS l2_blocks (
      id SERIAL PRIMARY KEY,
      block_number INTEGER UNIQUE NOT NULL,
      merkle_root VARCHAR(66) NOT NULL,
      ipfs_hash VARCHAR(100) NOT NULL,
      zcash_txid VARCHAR(64),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      state_data JSONB
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS l2_transactions (
      id SERIAL PRIMARY KEY,
      block_number INTEGER REFERENCES l2_blocks(block_number),
      tx_hash VARCHAR(66) NOT NULL,
      from_address VARCHAR(100),
      to_address VARCHAR(100),
      amount BIGINT,
      data JSONB,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('Database initialized');
};

// Store state to IPFS and return hash
const storeToIPFS = async (data) => {
  const { cid } = await ipfs.add(JSON.stringify(data));
  return cid.toString();
};

// Create Merkle tree from transactions
const createMerkleRoot = (transactions) => {
  const leaves = transactions.map(tx => 
    crypto.createHash('sha256').update(JSON.stringify(tx)).digest()
  );
  const tree = new MerkleTree(leaves, crypto.createHash('sha256'));
  return tree.getRoot().toString('hex');
};

// Anchor L2 state to Zcash
const anchorToZcash = async (merkleRoot, ipfsHash) => {
  try {
    // Create OP_RETURN transaction with IPFS hash and merkle root
    const data = `L2:${ipfsHash}:${merkleRoot}`;
    const hexData = Buffer.from(data).toString('hex');
    
    // This is a simplified version - in production you'd use proper Zcash transaction building
    const txid = await zcashRPC('sendtoaddress', [
      await zcashRPC('getnewaddress'),
      0.0001,
      `L2 State Anchor`,
      hexData
    ]);
    
    return txid;
  } catch (error) {
    console.error('Error anchoring to Zcash:', error.message);
    return null;
  }
};

// API Routes

// Submit L2 transaction
app.post('/api/l2/transaction', async (req, res) => {
  try {
    const { from, to, amount, data } = req.body;
    const txHash = crypto.randomBytes(32).toString('hex');
    
    await pool.query(
      'INSERT INTO l2_transactions (tx_hash, from_address, to_address, amount, data) VALUES ($1, $2, $3, $4, $5)',
      [txHash, from, to, amount, data]
    );
    
    res.json({ success: true, txHash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new L2 block
app.post('/api/l2/block/create', async (req, res) => {
  try {
    // Get pending transactions
    const result = await pool.query(
      'SELECT * FROM l2_transactions WHERE block_number IS NULL ORDER BY timestamp LIMIT 100'
    );
    const transactions = result.rows;
    
    if (transactions.length === 0) {
      return res.json({ message: 'No pending transactions' });
    }
    
    // Get next block number
    const blockResult = await pool.query(
      'SELECT COALESCE(MAX(block_number), 0) + 1 as next_block FROM l2_blocks'
    );
    const blockNumber = blockResult.rows[0].next_block;
    
    // Create merkle root
    const merkleRoot = createMerkleRoot(transactions);
    
    // Store state to IPFS
    const stateData = {
      blockNumber,
      transactions,
      merkleRoot,
      timestamp: new Date().toISOString(),
    };
    const ipfsHash = await storeToIPFS(stateData);
    
    // Anchor to Zcash
    const zcashTxid = await anchorToZcash(merkleRoot, ipfsHash);
    
    // Save block
    await pool.query(
      'INSERT INTO l2_blocks (block_number, merkle_root, ipfs_hash, zcash_txid, state_data) VALUES ($1, $2, $3, $4, $5)',
      [blockNumber, merkleRoot, ipfsHash, zcashTxid, stateData]
    );
    
    // Update transactions with block number
    const txIds = transactions.map(tx => tx.id);
    await pool.query(
      'UPDATE l2_transactions SET block_number = $1 WHERE id = ANY($2)',
      [blockNumber, txIds]
    );
    
    res.json({
      success: true,
      blockNumber,
      merkleRoot,
      ipfsHash,
      zcashTxid,
      transactionCount: transactions.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get L2 block by number
app.get('/api/l2/block/:number', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM l2_blocks WHERE block_number = $1',
      [req.params.number]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get state from IPFS
app.get('/api/l2/state/:ipfsHash', async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of ipfs.cat(req.params.ipfsHash)) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks).toString();
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const ipfsVersion = await ipfs.version();
    const zcashInfo = await zcashRPC('getinfo');
    const dbResult = await pool.query('SELECT COUNT(*) FROM l2_blocks');
    
    res.json({
      status: 'healthy',
      ipfs: ipfsVersion.version,
      zcash: zcashInfo.version,
      l2Blocks: parseInt(dbResult.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Zcash L2 Bridge running on port ${PORT}`);
  await initDB();
  console.log('💾 Database ready');
  console.log('🌐 IPFS connected');
  console.log('⚡ Ready to process L2 transactions');
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});