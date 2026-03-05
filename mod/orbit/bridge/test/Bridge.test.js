const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sr25519Bridge", function () {
  let token, bridge, owner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy BridgeToken
    const BridgeToken = await ethers.getContractFactory("BridgeToken");
    token = await BridgeToken.deploy("Bridged Commune", "BCOM", INITIAL_SUPPLY);
    await token.waitForDeployment();

    // Deploy Sr25519Bridge
    const Sr25519Bridge = await ethers.getContractFactory("Sr25519Bridge");
    bridge = await Sr25519Bridge.deploy(await token.getAddress());
    await bridge.waitForDeployment();

    // Approve bridge to spend owner's tokens
    await token.approve(await bridge.getAddress(), INITIAL_SUPPLY);
  });

  describe("Deployment", function () {
    it("Should set the right token", async function () {
      expect(await bridge.token()).to.equal(await token.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await bridge.owner()).to.equal(owner.address);
    });

    it("Should give operator initial supply", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("Claims", function () {
    const sr25519Hash = ethers.keccak256(ethers.toUtf8Bytes("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"));
    const claimAmount = ethers.parseEther("1000");

    it("Should process a valid claim", async function () {
      await expect(
        bridge.processClaim(sr25519Hash, user1.address, claimAmount)
      )
        .to.emit(bridge, "ClaimProcessed")
        .withArgs(sr25519Hash, user1.address, claimAmount);

      expect(await token.balanceOf(user1.address)).to.equal(claimAmount);
      expect(await bridge.claimed(sr25519Hash)).to.be.true;
      expect(await bridge.totalClaimed()).to.equal(claimAmount);
    });

    it("Should reject double claim", async function () {
      await bridge.processClaim(sr25519Hash, user1.address, claimAmount);

      await expect(
        bridge.processClaim(sr25519Hash, user1.address, claimAmount)
      ).to.be.revertedWith("Already claimed");
    });

    it("Should reject zero amount", async function () {
      await expect(
        bridge.processClaim(sr25519Hash, user1.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should reject zero address", async function () {
      await expect(
        bridge.processClaim(sr25519Hash, ethers.ZeroAddress, claimAmount)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should only allow owner to process claims", async function () {
      await expect(
        bridge.connect(user1).processClaim(sr25519Hash, user1.address, claimAmount)
      ).to.be.reverted;
    });
  });

  describe("Batch Claims", function () {
    const sr25519Hashes = [
      ethers.keccak256(ethers.toUtf8Bytes("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY")),
      ethers.keccak256(ethers.toUtf8Bytes("5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty")),
      ethers.keccak256(ethers.toUtf8Bytes("5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"))
    ];
    const recipients = [];
    const amounts = [];

    beforeEach(async function () {
      recipients.push(user1.address, user2.address, owner.address);
      amounts.push(
        ethers.parseEther("1000"),
        ethers.parseEther("2000"),
        ethers.parseEther("3000")
      );
    });

    it("Should batch process multiple claims", async function () {
      await bridge.batchProcessClaims(sr25519Hashes, recipients, amounts);

      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);

      expect(await bridge.claimed(sr25519Hashes[0])).to.be.true;
      expect(await bridge.claimed(sr25519Hashes[1])).to.be.true;
      expect(await bridge.claimed(sr25519Hashes[2])).to.be.true;

      const totalExpected = amounts.reduce((a, b) => a + b, 0n);
      expect(await bridge.totalClaimed()).to.equal(totalExpected);
    });

    it("Should reject mismatched array lengths", async function () {
      await expect(
        bridge.batchProcessClaims(
          sr25519Hashes,
          [user1.address, user2.address], // Missing one
          amounts
        )
      ).to.be.revertedWith("Array length mismatch");
    });

    it("Should skip already claimed addresses in batch", async function () {
      // Claim first one individually
      await bridge.processClaim(sr25519Hashes[0], user1.address, amounts[0]);

      // Batch should skip first, process others
      await bridge.batchProcessClaims(sr25519Hashes, recipients, amounts);

      // First user should only have first claim
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      // Second user should have their claim
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
    });
  });

  describe("View Functions", function () {
    const sr25519Hash = ethers.keccak256(ethers.toUtf8Bytes("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"));
    const claimAmount = ethers.parseEther("1000");

    it("Should check claim status", async function () {
      expect(await bridge.hasClaimed(sr25519Hash)).to.be.false;

      await bridge.processClaim(sr25519Hash, user1.address, claimAmount);

      expect(await bridge.hasClaimed(sr25519Hash)).to.be.true;
    });

    it("Should track claim recipient", async function () {
      await bridge.processClaim(sr25519Hash, user1.address, claimAmount);

      expect(await bridge.claimRecipient(sr25519Hash)).to.equal(user1.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update token address", async function () {
      const newToken = await (await ethers.getContractFactory("BridgeToken"))
        .deploy("New Token", "NEW", INITIAL_SUPPLY);

      await bridge.setToken(await newToken.getAddress());

      expect(await bridge.token()).to.equal(await newToken.getAddress());
    });

    it("Should reject non-owner updating token", async function () {
      await expect(
        bridge.connect(user1).setToken(await token.getAddress())
      ).to.be.reverted;
    });
  });
});
