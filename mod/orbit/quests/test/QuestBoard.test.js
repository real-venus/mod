const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('QuestBoard', function () {
  let questBoard, token;
  let owner, creator, referee, responder, responder2, treasury;
  const REWARD = ethers.parseUnits('100', 8); // 100 tokens (8 decimals)
  const CONTENT_HASH = ethers.keccak256(ethers.toUtf8Bytes('quest content'));
  const RESPONSE_HASH = ethers.keccak256(ethers.toUtf8Bytes('response content'));
  const RESPONSE_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes('response content 2'));

  beforeEach(async function () {
    [owner, creator, referee, responder, responder2, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory('TestToken');
    token = await Token.deploy('USDC', 'USDC', ethers.parseUnits('1000000', 8));
    await token.waitForDeployment();

    const QuestBoard = await ethers.getContractFactory('QuestBoard');
    questBoard = await QuestBoard.deploy(await token.getAddress(), treasury.address);
    await questBoard.waitForDeployment();

    // Fund creator
    await token.transfer(creator.address, ethers.parseUnits('10000', 8));
    // Approve questboard to spend creator's tokens
    await token.connect(creator).approve(await questBoard.getAddress(), ethers.MaxUint256);
  });

  // ==================== CREATION ====================

  describe('Quest Creation', function () {
    it('should create a quest with self-referee', async function () {
      const tx = await questBoard.connect(creator).createQuest(
        REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0
      );

      const quest = await questBoard.getQuest(1);
      expect(quest.creator).to.equal(creator.address);
      expect(quest.referee).to.equal(creator.address);
      expect(quest.refereeAccepted).to.be.true;
      expect(quest.refereeFee).to.equal(0);
      expect(quest.reward).to.equal(REWARD);
      expect(quest.status).to.equal(0); // Open

      // Tokens escrowed
      expect(await token.balanceOf(await questBoard.getAddress())).to.equal(REWARD);
    });

    it('should create quest with third-party referee', async function () {
      await questBoard.connect(creator).createQuest(
        REWARD, referee.address, 0, CONTENT_HASH, 0
      );

      const quest = await questBoard.getQuest(1);
      expect(quest.referee).to.equal(referee.address);
      expect(quest.refereeAccepted).to.be.false;
      expect(quest.refereeFee).to.equal(0); // set on accept
    });

    it('should create quest with deadline', async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 86400;
      await questBoard.connect(creator).createQuest(
        REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, futureTime
      );
      const quest = await questBoard.getQuest(1);
      expect(quest.deadline).to.equal(futureTime);
    });

    it('should revert with zero reward', async function () {
      await expect(
        questBoard.connect(creator).createQuest(0, ethers.ZeroAddress, 0, CONTENT_HASH, 0)
      ).to.be.revertedWith('Reward must be > 0');
    });

    it('should revert with empty content hash', async function () {
      await expect(
        questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, ethers.ZeroHash, 0)
      ).to.be.revertedWith('Content hash required');
    });

    it('should revert with past deadline', async function () {
      await expect(
        questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 1)
      ).to.be.revertedWith('Deadline must be in future');
    });

    it('should increment quest IDs', async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      const q1 = await questBoard.getQuest(1);
      const q2 = await questBoard.getQuest(2);
      expect(q1.id).to.equal(1);
      expect(q2.id).to.equal(2);
    });
  });

  // ==================== REFEREE ACCEPTANCE ====================

  describe('Referee Acceptance', function () {
    beforeEach(async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
    });

    it('should allow referee to accept with fee', async function () {
      await questBoard.connect(referee).acceptReferee(1, 1000); // 10%
      const quest = await questBoard.getQuest(1);
      expect(quest.refereeAccepted).to.be.true;
      expect(quest.refereeFee).to.equal(1000);
    });

    it('should allow referee to accept with 0% fee', async function () {
      await questBoard.connect(referee).acceptReferee(1, 0);
      const quest = await questBoard.getQuest(1);
      expect(quest.refereeFee).to.equal(0);
    });

    it('should revert if not designated referee', async function () {
      await expect(
        questBoard.connect(responder).acceptReferee(1, 1000)
      ).to.be.revertedWith('Not designated referee');
    });

    it('should revert if already accepted', async function () {
      await questBoard.connect(referee).acceptReferee(1, 1000);
      await expect(
        questBoard.connect(referee).acceptReferee(1, 500)
      ).to.be.revertedWith('Already accepted');
    });

    it('should revert if fee exceeds max', async function () {
      await expect(
        questBoard.connect(referee).acceptReferee(1, 5001) // > 50%
      ).to.be.revertedWith('Fee exceeds max');
    });

    it('should revert if combined fees too high', async function () {
      await expect(
        questBoard.connect(referee).acceptReferee(1, 9500) // 95% + 5% treasury = 100%
      ).to.be.revertedWith('Fee exceeds max'); // caught by MAX check first
    });

    it('should allow decline and reset to creator', async function () {
      await questBoard.connect(referee).declineReferee(1);
      const quest = await questBoard.getQuest(1);
      expect(quest.referee).to.equal(creator.address);
      expect(quest.refereeAccepted).to.be.true;
      expect(quest.refereeFee).to.equal(0);
    });

    it('should not allow creator-referee to decline', async function () {
      // Create self-refereed quest
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await expect(
        questBoard.connect(creator).declineReferee(2)
      ).to.be.revertedWith('Creator-referee cannot decline');
    });
  });

  // ==================== CHANGE REFEREE ====================

  describe('Change Referee', function () {
    it('should allow creator to change referee before acceptance', async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      await questBoard.connect(creator).changeReferee(1, responder.address);
      const quest = await questBoard.getQuest(1);
      expect(quest.referee).to.equal(responder.address);
      expect(quest.refereeAccepted).to.be.false;
    });

    it('should not allow change after referee accepted', async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      await questBoard.connect(referee).acceptReferee(1, 1000);
      await expect(
        questBoard.connect(creator).changeReferee(1, responder.address)
      ).to.be.revertedWith('Referee already accepted');
    });

    it('should allow change from self-referee', async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await questBoard.connect(creator).changeReferee(1, referee.address);
      const quest = await questBoard.getQuest(1);
      expect(quest.referee).to.equal(referee.address);
      expect(quest.refereeAccepted).to.be.false;
    });

    it('should not allow non-creator to change', async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      await expect(
        questBoard.connect(referee).changeReferee(1, responder.address)
      ).to.be.revertedWith('Not quest creator');
    });

    it('should not allow change after responses submitted', async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      await expect(
        questBoard.connect(creator).changeReferee(1, referee.address)
      ).to.be.revertedWith('Responses already submitted');
    });
  });

  // ==================== RESPONSES ====================

  describe('Response Submission', function () {
    beforeEach(async function () {
      // Self-refereed quest (auto-accepted)
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
    });

    it('should submit a response', async function () {
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      const resp = await questBoard.getResponse(1, 1);
      expect(resp.responder).to.equal(responder.address);
      expect(resp.contentHash).to.equal(RESPONSE_HASH);
      expect(resp.status).to.equal(0); // Pending
    });

    it('should prevent duplicate responses', async function () {
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      await expect(
        questBoard.connect(responder).submitResponse(1, RESPONSE_HASH)
      ).to.be.revertedWith('Already responded');
    });

    it('should allow multiple different responders', async function () {
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      await questBoard.connect(responder2).submitResponse(1, RESPONSE_HASH_2);
      expect(await questBoard.getQuestResponseCount(1)).to.equal(2);
    });

    it('should revert if referee not accepted', async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      await expect(
        questBoard.connect(responder).submitResponse(2, RESPONSE_HASH)
      ).to.be.revertedWith('Referee has not accepted');
    });

    it('should revert after deadline', async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 60;
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, futureTime);
      // Advance time past deadline
      await ethers.provider.send('evm_increaseTime', [120]);
      await ethers.provider.send('evm_mine');
      await expect(
        questBoard.connect(responder).submitResponse(2, RESPONSE_HASH)
      ).to.be.revertedWith('Quest deadline passed');
    });
  });

  // ==================== APPROVAL ====================

  describe('Response Approval', function () {
    describe('Self-Referee', function () {
      beforeEach(async function () {
        await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
        await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      });

      it('should approve and pay responder (self-referee, 0% referee fee)', async function () {
        const responderBefore = await token.balanceOf(responder.address);
        const treasuryBefore = await token.balanceOf(treasury.address);

        await questBoard.connect(creator).approveResponse(1, 1);

        const quest = await questBoard.getQuest(1);
        expect(quest.status).to.equal(1); // Completed

        // 5% treasury, 0% referee, 95% responder
        const treasuryFee = (REWARD * BigInt(500)) / BigInt(10000);
        const responderAmount = REWARD - treasuryFee;

        expect(await token.balanceOf(responder.address)).to.equal(responderBefore + responderAmount);
        expect(await token.balanceOf(treasury.address)).to.equal(treasuryBefore + treasuryFee);
        expect(await token.balanceOf(await questBoard.getAddress())).to.equal(0);
      });
    });

    describe('Third-Party Referee', function () {
      beforeEach(async function () {
        await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
        await questBoard.connect(referee).acceptReferee(1, 1000); // 10%
        await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      });

      it('should split payment: treasury + referee + responder', async function () {
        const responderBefore = await token.balanceOf(responder.address);
        const refereeBefore = await token.balanceOf(referee.address);
        const treasuryBefore = await token.balanceOf(treasury.address);

        await questBoard.connect(referee).approveResponse(1, 1);

        // 100 tokens: 5% treasury = 5, 10% referee = 10, 85% responder = 85
        const treasuryFee = (REWARD * BigInt(500)) / BigInt(10000);
        const refereeFee = (REWARD * BigInt(1000)) / BigInt(10000);
        const responderAmount = REWARD - treasuryFee - refereeFee;

        expect(await token.balanceOf(responder.address)).to.equal(responderBefore + responderAmount);
        expect(await token.balanceOf(referee.address)).to.equal(refereeBefore + refereeFee);
        expect(await token.balanceOf(treasury.address)).to.equal(treasuryBefore + treasuryFee);
        expect(await token.balanceOf(await questBoard.getAddress())).to.equal(0);
      });

      it('should only allow referee to approve', async function () {
        await expect(
          questBoard.connect(creator).approveResponse(1, 1)
        ).to.be.revertedWith('Not quest referee');
      });

      it('should not allow referee to approve own response', async function () {
        // Referee responds
        await questBoard.connect(referee).submitResponse(1, RESPONSE_HASH_2);
        await expect(
          questBoard.connect(referee).approveResponse(1, 2)
        ).to.be.revertedWith('Cannot approve own response');
      });

      it('should revert on double approval', async function () {
        await questBoard.connect(referee).approveResponse(1, 1);
        await expect(
          questBoard.connect(referee).approveResponse(1, 1)
        ).to.be.revertedWith('Quest not open');
      });
    });
  });

  // ==================== REJECTION ====================

  describe('Response Rejection', function () {
    beforeEach(async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      await questBoard.connect(referee).acceptReferee(1, 1000);
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
    });

    it('should reject a response', async function () {
      await questBoard.connect(referee).rejectResponse(1, 1);
      const resp = await questBoard.getResponse(1, 1);
      expect(resp.status).to.equal(2); // Rejected
    });

    it('should only allow referee to reject', async function () {
      await expect(
        questBoard.connect(creator).rejectResponse(1, 1)
      ).to.be.revertedWith('Not quest referee');
    });

    it('should not reject already rejected', async function () {
      await questBoard.connect(referee).rejectResponse(1, 1);
      await expect(
        questBoard.connect(referee).rejectResponse(1, 1)
      ).to.be.revertedWith('Response not pending');
    });

    it('quest stays open after rejection (can approve another)', async function () {
      await questBoard.connect(responder2).submitResponse(1, RESPONSE_HASH_2);
      await questBoard.connect(referee).rejectResponse(1, 1);

      const quest = await questBoard.getQuest(1);
      expect(quest.status).to.equal(0); // Still Open

      // Can still approve another response
      await questBoard.connect(referee).approveResponse(1, 2);
      const quest2 = await questBoard.getQuest(1);
      expect(quest2.status).to.equal(1); // Completed
    });
  });

  // ==================== CANCELLATION ====================

  describe('Quest Cancellation', function () {
    beforeEach(async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
    });

    it('should refund creator on cancel', async function () {
      const balanceBefore = await token.balanceOf(creator.address);
      await questBoard.connect(creator).cancelQuest(1);

      expect(await token.balanceOf(creator.address)).to.equal(balanceBefore + REWARD);
      const quest = await questBoard.getQuest(1);
      expect(quest.status).to.equal(2); // Cancelled
    });

    it('should only allow creator to cancel', async function () {
      await expect(
        questBoard.connect(responder).cancelQuest(1)
      ).to.be.revertedWith('Not quest creator');
    });

    it('should not cancel completed quest', async function () {
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);
      await questBoard.connect(creator).approveResponse(1, 1);
      await expect(
        questBoard.connect(creator).cancelQuest(1)
      ).to.be.revertedWith('Quest not open');
    });

    it('should not cancel already cancelled', async function () {
      await questBoard.connect(creator).cancelQuest(1);
      await expect(
        questBoard.connect(creator).cancelQuest(1)
      ).to.be.revertedWith('Quest not open');
    });
  });

  // ==================== ADMIN ====================

  describe('Admin', function () {
    it('should update treasury', async function () {
      await questBoard.connect(owner).setTreasury(responder.address);
      expect(await questBoard.treasury()).to.equal(responder.address);
    });

    it('should not allow non-owner to set treasury', async function () {
      await expect(
        questBoard.connect(creator).setTreasury(responder.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should go ownerless', async function () {
      await questBoard.connect(owner).setOwnerless();
      await expect(
        questBoard.connect(owner).setTreasury(responder.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', function () {
    it('should handle max referee fee (50%)', async function () {
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);
      // 50% + 5% treasury = 55%, leaving 45% for responder
      await questBoard.connect(referee).acceptReferee(1, 5000);
      await questBoard.connect(responder).submitResponse(1, RESPONSE_HASH);

      const responderBefore = await token.balanceOf(responder.address);
      await questBoard.connect(referee).approveResponse(1, 1);

      const treasuryFee = (REWARD * BigInt(500)) / BigInt(10000);
      const refereeFee = (REWARD * BigInt(5000)) / BigInt(10000);
      const responderAmount = REWARD - treasuryFee - refereeFee;

      expect(await token.balanceOf(responder.address)).to.equal(responderBefore + responderAmount);
    });

    it('should handle multiple quests independently', async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await questBoard.connect(creator).createQuest(REWARD, referee.address, 0, CONTENT_HASH, 0);

      // Cancel first, accept referee on second
      await questBoard.connect(creator).cancelQuest(1);
      await questBoard.connect(referee).acceptReferee(2, 500);

      const q1 = await questBoard.getQuest(1);
      const q2 = await questBoard.getQuest(2);
      expect(q1.status).to.equal(2); // Cancelled
      expect(q2.status).to.equal(0); // Open
      expect(q2.refereeAccepted).to.be.true;
    });

    it('should revert on non-existent quest', async function () {
      await expect(questBoard.getQuest(999)).to.be.revertedWith('Quest not found');
    });

    it('should revert on non-existent response', async function () {
      await questBoard.connect(creator).createQuest(REWARD, ethers.ZeroAddress, 0, CONTENT_HASH, 0);
      await expect(questBoard.getResponse(1, 999)).to.be.revertedWith('Response not found');
    });
  });
});
