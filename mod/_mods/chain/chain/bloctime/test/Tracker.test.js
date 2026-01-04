const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BlocTimeTracker Tests', function () {
  let owner, user1, user2, server;
  let blocTimeToken, tracker;
  const EPOCH_INTERVAL = 10000;

  beforeEach(async function () {
    [owner, user1, user2, server] = await ethers.getSigners();

    const BlocTimeToken = await ethers.getContractFactory('BlocTimeToken');
    blocTimeToken = await BlocTimeToken.deploy('BlocTime Token', 'BLOC');
    await blocTimeToken.waitForDeployment();

    const BlocTimeTracker = await ethers.getContractFactory('BlocTimeTracker');
    tracker = await BlocTimeTracker.deploy(
      await blocTimeToken.getAddress(),
      EPOCH_INTERVAL
    );
    await tracker.waitForDeployment();

    // Mint tokens to users
    await blocTimeToken.mint(user1.address, ethers.parseEther('10000'));
    await blocTimeToken.mint(user2.address, ethers.parseEther('5000'));

    // Approve tracker to spend tokens
    await blocTimeToken.connect(user1).approve(await tracker.getAddress(), ethers.parseEther('10000'));
    await blocTimeToken.connect(user2).approve(await tracker.getAddress(), ethers.parseEther('5000'));
  });

  describe('Session Management - Legacy Direct', function () {
    it('should start session directly', async function () {
      await expect(tracker.connect(user1).startSession())
        .to.emit(tracker, 'SessionStarted')
        .withArgs(user1.address, await ethers.provider.getBlockNumber() + 1, ethers.parseEther('10000'), user1.address);

      const [startBlock, , totalBlocTime, isActive, ] = await tracker.getUserSession(user1.address);
      expect(isActive).to.be.true;
      expect(totalBlocTime).to.equal(ethers.parseEther('10000'));
    });

    it('should reject starting session when already active', async function () {
      await tracker.connect(user1).startSession();
      await expect(tracker.connect(user1).startSession()).to.be.revertedWith('Session already active');
    });

    it('should stop session and deduct bloctime', async function () {
      await tracker.connect(user1).startSession();
      const startBlock = await ethers.provider.getBlockNumber();

      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(100)]);

      await expect(tracker.connect(user1).stopSession())
        .to.emit(tracker, 'SessionStopped');

      const [, stopBlock, , isActive, ] = await tracker.getUserSession(user1.address);
      expect(isActive).to.be.false;
      expect(stopBlock).to.be.gt(startBlock);
    });
  });

  describe('Session Management - With Signatures', function () {
    it('should start session with valid signature', async function () {
      const startBlock = await ethers.provider.getBlockNumber() + 1;
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['START', user1.address, startBlock]
      );
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      await expect(tracker.connect(server).startSessionWithSignature(user1.address, startBlock, signature))
        .to.emit(tracker, 'SessionStarted')
        .withArgs(user1.address, startBlock, ethers.parseEther('10000'), server.address);

      const [, , , isActive, ] = await tracker.getUserSession(user1.address);
      expect(isActive).to.be.true;
    });

    it('should reject invalid signature', async function () {
      const startBlock = await ethers.provider.getBlockNumber() + 1;
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['START', user1.address, startBlock]
      );
      const signature = await user2.signMessage(ethers.getBytes(messageHash));

      await expect(
        tracker.connect(server).startSessionWithSignature(user1.address, startBlock, signature)
      ).to.be.revertedWith('Invalid signature');
    });

    it('should reject reused signature', async function () {
      const startBlock = await ethers.provider.getBlockNumber() + 1;
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['START', user1.address, startBlock]
      );
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      await tracker.connect(server).startSessionWithSignature(user1.address, startBlock, signature);
      await tracker.connect(user1).stopSession();

      await expect(
        tracker.connect(server).startSessionWithSignature(user1.address, startBlock, signature)
      ).to.be.revertedWith('Signature already used');
    });

    it('should stop session with valid signature', async function () {
      await tracker.connect(user1).startSession();
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(100)]);

      const stopBlock = await ethers.provider.getBlockNumber() + 1;
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256'],
        ['STOP', user1.address, stopBlock]
      );
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      await expect(tracker.connect(server).stopSessionWithSignature(user1.address, stopBlock, signature))
        .to.emit(tracker, 'SessionStopped');

      const [, , , isActive, ] = await tracker.getUserSession(user1.address);
      expect(isActive).to.be.false;
    });
  });

  describe('Epoch Management', function () {
    it('should set epoch interval', async function () {
      const newInterval = 20000;
      await expect(tracker.setEpochInterval(newInterval))
        .to.emit(tracker, 'EpochIntervalUpdated')
        .withArgs(newInterval);

      expect(await tracker.epochInterval()).to.equal(newInterval);
    });

    it('should reject zero epoch interval', async function () {
      await expect(tracker.setEpochInterval(0)).to.be.revertedWith('Invalid epoch interval');
    });

    it('should allow owner to clear maps', async function () {
      await expect(tracker.clearMaps())
        .to.emit(tracker, 'MapCleared');
    });

    it('should allow auto-clear after epoch interval', async function () {
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(EPOCH_INTERVAL)]);
      await expect(tracker.connect(user1).clearMaps())
        .to.emit(tracker, 'MapCleared');
    });
  });

  describe('BlocTime Deduction', function () {
    it('should deduct bloctime on session stop', async function () {
      const initialBalance = await blocTimeToken.balanceOf(user1.address);
      await tracker.connect(user1).startSession();
      
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(100)]);
      
      await tracker.connect(user1).stopSession();
      
      const finalBalance = await blocTimeToken.balanceOf(user1.address);
      expect(finalBalance).to.be.lt(initialBalance);
    });

    it('should reject stop when insufficient bloctime', async function () {
      await tracker.connect(user1).startSession();
      
      // Mine more blocks than user has bloctime
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(20000)]);
      
      await expect(tracker.connect(user1).stopSession()).to.be.revertedWith('Insufficient bloctime');
    });
  });

  describe('Session Info', function () {
    it('should return correct session info', async function () {
      await tracker.connect(user1).startSession();
      const startBlockNum = await ethers.provider.getBlockNumber();
      
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(50)]);
      
      const [startBlock, stopBlock, totalBlocTime, isActive, blocksElapsed] = 
        await tracker.getUserSession(user1.address);
      
      expect(startBlock).to.equal(startBlockNum);
      expect(stopBlock).to.equal(0);
      expect(totalBlocTime).to.equal(ethers.parseEther('10000'));
      expect(isActive).to.be.true;
      expect(blocksElapsed).to.be.gt(0);
    });
  });

  describe('Withdraw', function () {
    it('should allow owner to withdraw collected bloctime', async function () {
      await tracker.connect(user1).startSession();
      await ethers.provider.send('hardhat_mine', [ethers.toQuantity(100)]);
      await tracker.connect(user1).stopSession();

      const trackerBalance = await blocTimeToken.balanceOf(await tracker.getAddress());
      expect(trackerBalance).to.be.gt(0);

      const ownerBalanceBefore = await blocTimeToken.balanceOf(owner.address);
      await tracker.withdrawBlocTime(trackerBalance);
      const ownerBalanceAfter = await blocTimeToken.balanceOf(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(trackerBalance);
    });
  });
});
