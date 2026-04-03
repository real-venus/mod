const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvoCoin Protocol", function () {
  let evoToken, exchange, registry, factory;
  let owner, creator, buyer, user2;
  const INITIAL_SUPPLY = ethers.parseEther("10000000");

  beforeEach(async function () {
    [owner, creator, buyer, user2] = await ethers.getSigners();

    const EvoToken = await ethers.getContractFactory("EvoToken");
    evoToken = await EvoToken.deploy(INITIAL_SUPPLY);
    await evoToken.waitForDeployment();

    const HubExchange = await ethers.getContractFactory("HubExchange");
    exchange = await HubExchange.deploy(await evoToken.getAddress());
    await exchange.waitForDeployment();

    const EvoRegistry = await ethers.getContractFactory("EvoRegistry");
    registry = await EvoRegistry.deploy();
    await registry.waitForDeployment();

    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactory.deploy(
      await exchange.getAddress(),
      await registry.getAddress(),
      await evoToken.getAddress(),
      0
    );
    await factory.waitForDeployment();

    await exchange.setFactory(await factory.getAddress());
    await registry.setFactory(await factory.getAddress());

    await evoToken.transfer(buyer.address, ethers.parseEther("100000"));
    await evoToken.transfer(creator.address, ethers.parseEther("10000"));
  });

  async function createSpoke(signer, opts = {}) {
    const {
      name = "TestSpoke", symbol = "TST",
      curveType = 0, curveParam = ethers.parseEther("0.001"),
      buyFeeBps = 100, sellFeeBps = 100, burnBps = 5000,
      metadata = '{"desc":"test"}'
    } = opts;

    const tx = await factory.connect(signer).createToken(
      name, symbol, curveType, curveParam, buyFeeBps, sellFeeBps, burnBps, metadata
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return factory.interface.parseLog(l)?.name === "TokenCreated"; }
      catch { return false; }
    });
    return factory.interface.parseLog(event).args.token;
  }

  describe("EvoToken", function () {
    it("should deploy with correct supply", async function () {
      expect(await evoToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await evoToken.name()).to.equal("EvoToken");
      expect(await evoToken.symbol()).to.equal("EVO");
    });

    it("should allow owner to mint", async function () {
      await evoToken.mint(user2.address, ethers.parseEther("1000"));
      expect(await evoToken.balanceOf(user2.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should reject mint from non-owner", async function () {
      await expect(
        evoToken.connect(buyer).mint(buyer.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("TokenFactory", function () {
    it("should create spoke with linear curve", async function () {
      const addr = await createSpoke(creator, { curveType: 0 });
      expect(addr).to.be.properAddress;
      const spoke = await ethers.getContractAt("SpokeToken", addr);
      expect(await spoke.name()).to.equal("TestSpoke");
      expect(await spoke.exchange()).to.equal(await exchange.getAddress());
      expect(await spoke.creator()).to.equal(creator.address);
    });

    it("should create all 4 curve types", async function () {
      for (let i = 0; i <= 3; i++) {
        const addr = await createSpoke(creator, {
          name: `S${i}`, symbol: `S${i}`, curveType: i
        });
        expect(addr).to.be.properAddress;
      }
    });

    it("should reject fees > 10%", async function () {
      await expect(
        factory.connect(creator).createToken("X", "X", 0, ethers.parseEther("0.001"), 1001, 100, 5000, "{}")
      ).to.be.revertedWith("Buy fee max 10%");
      await expect(
        factory.connect(creator).createToken("X", "X", 0, ethers.parseEther("0.001"), 100, 1001, 5000, "{}")
      ).to.be.revertedWith("Sell fee max 10%");
    });

    it("should register in registry", async function () {
      const addr = await createSpoke(creator);
      const info = await registry.getTokenByAddress(addr);
      expect(info.name).to.equal("TestSpoke");
      expect(info.creator).to.equal(creator.address);
      expect(info.active).to.be.true;
    });

    it("should collect creation fee", async function () {
      await factory.setCreationFee(ethers.parseEther("100"));
      await evoToken.connect(creator).approve(await factory.getAddress(), ethers.parseEther("100"));
      const before = await evoToken.balanceOf(owner.address);
      await createSpoke(creator);
      expect(await evoToken.balanceOf(owner.address)).to.equal(before + ethers.parseEther("100"));
    });
  });

  describe("HubExchange - Linear", function () {
    let spokeAddr, spoke;

    beforeEach(async function () {
      spokeAddr = await createSpoke(creator, {
        curveType: 0, curveParam: ethers.parseEther("0.001"),
        buyFeeBps: 100, sellFeeBps: 100, burnBps: 5000
      });
      spoke = await ethers.getContractAt("SpokeToken", spokeAddr);
    });

    it("should buy and mint tokens", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("100"));
      await exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("100"), 0);
      expect(await spoke.balanceOf(buyer.address)).to.be.gt(0);
    });

    it("should increase price with supply", async function () {
      const amt = ethers.parseEther("100");
      await evoToken.connect(buyer).approve(await exchange.getAddress(), amt * BigInt(2));
      await exchange.connect(buyer).buy(spokeAddr, amt, 0);
      const bal1 = await spoke.balanceOf(buyer.address);
      await exchange.connect(buyer).buy(spokeAddr, amt, 0);
      const secondBuy = (await spoke.balanceOf(buyer.address)) - bal1;
      expect(secondBuy).to.be.lt(bal1);
    });

    it("should sell and return EVO", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("100"));
      await exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("100"), 0);
      const tokenBal = await spoke.balanceOf(buyer.address);
      const evoBefore = await evoToken.balanceOf(buyer.address);
      await exchange.connect(buyer).sell(spokeAddr, tokenBal, 0);
      expect(await evoToken.balanceOf(buyer.address)).to.be.gt(evoBefore);
      expect(await spoke.balanceOf(buyer.address)).to.equal(0);
    });

    it("should enforce slippage on buy", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("10"));
      await expect(
        exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("10"), ethers.parseEther("999999999"))
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("should enforce slippage on sell", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("100"));
      await exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("100"), 0);
      const bal = await spoke.balanceOf(buyer.address);
      await expect(
        exchange.connect(buyer).sell(spokeAddr, bal, ethers.parseEther("999999999"))
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("should distribute fees to creator", async function () {
      const amt = ethers.parseEther("1000");
      await evoToken.connect(buyer).approve(await exchange.getAddress(), amt);
      const before = await evoToken.balanceOf(creator.address);
      await exchange.connect(buyer).buy(spokeAddr, amt, 0);
      // 1% fee, 50% burn, 50% to creator = 0.5%
      expect(await evoToken.balanceOf(creator.address)).to.equal(
        before + (amt * BigInt(50) / BigInt(10000))
      );
    });

    it("should track volume and trades", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("100"));
      await exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("100"), 0);
      const info = await exchange.getSpokeInfo(spokeAddr);
      expect(info.totalVolume).to.equal(ethers.parseEther("100"));
      expect(info.totalTrades).to.equal(1);
    });
  });

  describe("HubExchange - Fixed", function () {
    let spokeAddr, spoke;

    beforeEach(async function () {
      spokeAddr = await createSpoke(creator, {
        name: "Fixed", symbol: "FIX", curveType: 3,
        curveParam: ethers.parseEther("0.5"),
        buyFeeBps: 0, sellFeeBps: 0, burnBps: 0
      });
      spoke = await ethers.getContractAt("SpokeToken", spokeAddr);
    });

    it("should buy at fixed rate", async function () {
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("100"));
      await exchange.connect(buyer).buy(spokeAddr, ethers.parseEther("100"), 0);
      expect(await spoke.balanceOf(buyer.address)).to.equal(ethers.parseEther("200"));
    });

    it("should sell at fixed rate with no fees", async function () {
      const amt = ethers.parseEther("100");
      await evoToken.connect(buyer).approve(await exchange.getAddress(), amt);
      await exchange.connect(buyer).buy(spokeAddr, amt, 0);
      const tokenBal = await spoke.balanceOf(buyer.address);
      const evoBefore = await evoToken.balanceOf(buyer.address);
      await exchange.connect(buyer).sell(spokeAddr, tokenBal, 0);
      expect((await evoToken.balanceOf(buyer.address)) - evoBefore).to.equal(amt);
    });
  });

  describe("EvoRegistry", function () {
    it("should track creator tokens", async function () {
      await createSpoke(creator, { name: "T1", symbol: "T1" });
      await createSpoke(creator, { name: "T2", symbol: "T2" });
      expect((await registry.getCreatorTokens(creator.address)).length).to.equal(2);
    });

    it("should reject non-factory registration", async function () {
      await expect(
        registry.connect(user2).registerToken(user2.address, user2.address, "X", "X", 0, 1000, "{}")
      ).to.be.revertedWith("Only factory");
    });

    it("should update fitness scores", async function () {
      const addr = await createSpoke(creator);
      const id = await registry.tokenToId(addr);
      await registry.updateFitness(id, 9500);
      expect((await registry.getToken(id)).fitnessScore).to.equal(9500);
    });

    it("should batch update fitness", async function () {
      const a1 = await createSpoke(creator, { name: "T1", symbol: "T1" });
      const a2 = await createSpoke(creator, { name: "T2", symbol: "T2" });
      await registry.batchUpdateFitness(
        [await registry.tokenToId(a1), await registry.tokenToId(a2)],
        [8000, 9000]
      );
      expect((await registry.getToken(await registry.tokenToId(a1))).fitnessScore).to.equal(8000);
      expect((await registry.getToken(await registry.tokenToId(a2))).fitnessScore).to.equal(9000);
    });

    it("should paginate tokens", async function () {
      await createSpoke(creator, { name: "T1", symbol: "T1" });
      await createSpoke(creator, { name: "T2", symbol: "T2" });
      await createSpoke(creator, { name: "T3", symbol: "T3" });
      const page = await registry.getTokensPaginated(1, 2);
      expect(page.length).to.equal(2);
    });

    it("should deprecate tokens", async function () {
      const addr = await createSpoke(creator);
      const id = await registry.tokenToId(addr);
      await registry.deprecateToken(id);
      expect((await registry.getToken(id)).active).to.be.false;
    });
  });

  describe("Integration", function () {
    it("full flow: create -> buy -> sell", async function () {
      const addr = await createSpoke(creator);
      expect(await registry.getTokenCount()).to.equal(1);

      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("500"));
      await exchange.connect(buyer).buy(addr, ethers.parseEther("500"), 0);
      const spoke = await ethers.getContractAt("SpokeToken", addr);
      const bal = await spoke.balanceOf(buyer.address);
      expect(bal).to.be.gt(0);

      await exchange.connect(buyer).sell(addr, bal / BigInt(2), 0);
      expect(await spoke.balanceOf(buyer.address)).to.be.closeTo(bal - bal / BigInt(2), 1);
      expect((await exchange.getSpokeInfo(addr)).totalTrades).to.equal(2);
    });

    it("two independent spokes", async function () {
      const a1 = await createSpoke(creator, { name: "Alpha", symbol: "A", curveType: 0 });
      const a2 = await createSpoke(creator, { name: "Beta", symbol: "B", curveType: 3, curveParam: ethers.parseEther("2") });

      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("200"));
      await exchange.connect(buyer).buy(a1, ethers.parseEther("100"), 0);
      await exchange.connect(buyer).buy(a2, ethers.parseEther("100"), 0);

      const s1 = await ethers.getContractAt("SpokeToken", a1);
      const s2 = await ethers.getContractAt("SpokeToken", a2);
      expect(await s1.balanceOf(buyer.address)).to.be.gt(0);
      expect(await s2.balanceOf(buyer.address)).to.be.gt(0);
    });

    it("deprecated spoke blocks trading", async function () {
      const addr = await createSpoke(creator);
      await exchange.deprecateSpoke(addr);
      await evoToken.connect(buyer).approve(await exchange.getAddress(), ethers.parseEther("10"));
      await expect(
        exchange.connect(buyer).buy(addr, ethers.parseEther("10"), 0)
      ).to.be.revertedWith("Spoke not active");
    });
  });
});
