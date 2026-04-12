const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BridgeableToken", function () {
  let bridge, owner, user1, user2;
  const SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Bridge = await ethers.getContractFactory("BridgeableToken");
    bridge = await Bridge.deploy("Bridge Token", "BRG", SUPPLY);
    await bridge.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should mint initial supply to deployer", async function () {
      expect(await bridge.balanceOf(owner.address)).to.equal(SUPPLY);
    });

    it("Should deploy with zero initial supply", async function () {
      const Bridge = await ethers.getContractFactory("BridgeableToken");
      const b = await Bridge.deploy("Zero", "ZRO", 0);
      await b.waitForDeployment();
      expect(await b.totalSupply()).to.equal(0);
    });
  });

  describe("Bridge Mint", function () {
    it("Should mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await expect(bridge.bridgeMint(user1.address, amount, "bridge-1"))
        .to.emit(bridge, "BridgeMint")
        .withArgs(user1.address, amount, "bridge-1");
      expect(await bridge.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should reject mint to zero address", async function () {
      await expect(
        bridge.bridgeMint(ethers.ZeroAddress, 100, "x")
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should reject zero amount", async function () {
      await expect(
        bridge.bridgeMint(user1.address, 0, "x")
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject non-owner", async function () {
      await expect(
        bridge.connect(user1).bridgeMint(user1.address, 100, "x")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Bridge Burn", function () {
    beforeEach(async function () {
      await bridge.bridgeMint(user1.address, ethers.parseEther("100"), "mint-1");
    });

    it("Should burn tokens", async function () {
      const amount = ethers.parseEther("50");
      await expect(bridge.bridgeBurn(user1.address, amount, "burn-1"))
        .to.emit(bridge, "BridgeBurn");
      expect(await bridge.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should reject burn with insufficient balance", async function () {
      await expect(
        bridge.bridgeBurn(user1.address, ethers.parseEther("200"), "x")
      ).to.be.revertedWith("Insufficient balance to burn");
    });
  });

  describe("Batch Operations", function () {
    it("Should batch mint", async function () {
      const amounts = [ethers.parseEther("10"), ethers.parseEther("20")];
      await bridge.batchBridgeMint([user1.address, user2.address], amounts, "batch-1");
      expect(await bridge.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await bridge.balanceOf(user2.address)).to.equal(amounts[1]);
    });

    it("Should batch burn", async function () {
      await bridge.batchBridgeMint(
        [user1.address, user2.address],
        [ethers.parseEther("100"), ethers.parseEther("100")],
        "setup"
      );
      await bridge.batchBridgeBurn(
        [user1.address, user2.address],
        [ethers.parseEther("50"), ethers.parseEther("50")],
        "batch-burn-1"
      );
      expect(await bridge.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await bridge.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should reject mismatched arrays", async function () {
      await expect(
        bridge.batchBridgeMint([user1.address], [100, 200], "x")
      ).to.be.revertedWith("Arrays length mismatch");
    });
  });

  describe("Commitments", function () {
    it("Should commit a source address to an EVM address", async function () {
      const sourceAddr = "5HgA2JHaR4NXVYBN8WV7hU1eFGTJFQQ8PpQzMgEoAPXJNQzb";
      const sourceHash = ethers.keccak256(ethers.toUtf8Bytes(sourceAddr));

      await expect(bridge.commit(sourceHash, user1.address, sourceAddr, "substrate"))
        .to.emit(bridge, "Commitment")
        .withArgs(sourceHash, user1.address, sourceAddr, "substrate");

      expect(await bridge.getCommitment(sourceHash)).to.equal(user1.address);
    });

    it("Should track multiple commitments per EVM address", async function () {
      const addr1 = "5HgA2JHaR4NXVYBN8WV7hU1eFGTJFQQ8PpQzMgEoAPXJNQzb";
      const addr2 = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes(addr1));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes(addr2));

      await bridge.commit(hash1, user1.address, addr1, "substrate");
      await bridge.commit(hash2, user1.address, addr2, "solana");

      const commitments = await bridge.getEvmCommitments(user1.address);
      expect(commitments.length).to.equal(2);
      expect(commitments[0]).to.equal(hash1);
      expect(commitments[1]).to.equal(hash2);
    });

    it("Should reject duplicate commitment", async function () {
      const sourceAddr = "5HgA2JHaR4NXVYBN8WV7hU1eFGTJFQQ8PpQzMgEoAPXJNQzb";
      const sourceHash = ethers.keccak256(ethers.toUtf8Bytes(sourceAddr));

      await bridge.commit(sourceHash, user1.address, sourceAddr, "substrate");
      await expect(
        bridge.commit(sourceHash, user2.address, sourceAddr, "substrate")
      ).to.be.revertedWith("Already committed");
    });

    it("Should reject commitment to zero address", async function () {
      const sourceAddr = "5HgA2JHaR4NXVYBN8WV7hU1eFGTJFQQ8PpQzMgEoAPXJNQzb";
      const sourceHash = ethers.keccak256(ethers.toUtf8Bytes(sourceAddr));

      await expect(
        bridge.commit(sourceHash, ethers.ZeroAddress, sourceAddr, "substrate")
      ).to.be.revertedWith("Invalid EVM address");
    });

    it("Should reject non-owner commitment", async function () {
      const sourceAddr = "5HgA2JHaR4NXVYBN8WV7hU1eFGTJFQQ8PpQzMgEoAPXJNQzb";
      const sourceHash = ethers.keccak256(ethers.toUtf8Bytes(sourceAddr));

      await expect(
        bridge.connect(user1).commit(sourceHash, user1.address, sourceAddr, "substrate")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should return empty commitments for unknown hash", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      expect(await bridge.getCommitment(fakeHash)).to.equal(ethers.ZeroAddress);
    });

    it("Should return empty array for address with no commitments", async function () {
      const commitments = await bridge.getEvmCommitments(user1.address);
      expect(commitments.length).to.equal(0);
    });
  });

  describe("Set Ownerless", function () {
    it("Should lock minting after ownerless", async function () {
      await bridge.setOwnerless();
      await expect(
        bridge.bridgeMint(user1.address, 100, "x")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should lock commitments after ownerless", async function () {
      await bridge.setOwnerless();
      const sourceHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(
        bridge.commit(sourceHash, user1.address, "test", "substrate")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
