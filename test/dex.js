const { expectRevert } = require("@openzeppelin/test-helpers");

const Dex = artifacts.require("Dex");
const Bat = artifacts.require("Bat");
const Dai = artifacts.require("Dai");
const Zrx = artifacts.require("Zrx");
const Rep = artifacts.require("Rep");

const SIDE = { BUY: 0, SELL: 1 };

contract("Dex", function (accounts) {
  //deploy mock tokens
  let dai, bat, rep, zrx;
  let dex;
  const [DAI, BAT, REP, ZRX] = ["DAI", "BAT", "REP", "ZRX"].map((ticker) =>
    web3.utils.asciiToHex(ticker)
  );
  const [trader1, trader2] = [accounts[1], accounts[2]];
  const amount = web3.utils.toWei("1000");

  beforeEach(async () => {
    [dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new(),
    ]);

    dex = await Dex.new();
    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);
    //fill in the token balances of the 2 traders
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount, { from: trader });
    };
    await Promise.all(
      [dai, bat, rep, zrx].map((token) => {
        seedTokenBalance(token, trader1);
        seedTokenBalance(token, trader2);
      })
    );
  });

  describe("#deposit()", async () => {
    beforeEach(async () => {
      await dai.approve(dex.address, amount, { from: trader1 });
    });
    it("should deposit token in user's balance", async () => {
      await dex.deposit(amount, DAI, { from: trader1 });
      //balance of the user in the token should be decreased
      // and his balance in the dex should be increased
      const balance = await dex.traderBalances(trader1, DAI);
      assert.equal(balance.toString(), amount);
    });
    it("should NOT deposit token if token does not exist", async () => {
      await expectRevert(
        dex.deposit(
          web3.utils.toWei("1000"),
          web3.utils.asciiToHex("TOKEN-DOES-NOT-EXIST"),
          { from: trader1 }
        ),
        "this token does not exist"
      );
    });
  });

  describe("#withdraw()", async () => {
    const withAmount = web3.utils.toWei("100");
    const deposit = async () => {
      await bat.approve(dex.address, withAmount, { from: trader1 });
      await dex.deposit(withAmount, BAT, { from: trader1 });
    };
    it("should transfer tokens to the user balance", async () => {
      await deposit();
      await dex.withdraw(withAmount, BAT, { from: trader1 });
      const balanceDex = await dex.traderBalances(trader1, BAT);
      const balanceBAT = await bat.balanceOf(trader1);
      assert.equal(
        balanceDex.toString(),
        "0",
        "DEX balance of trader1 from BAT should be null"
      );
      assert.equal(
        balanceBAT,
        amount,
        "BAT balance of trader1 should return to its initial state"
      );
    });

    it("should NOT withdraw if token does not exist", async () => {
      await expectRevert(
        dex.withdraw(
          withAmount,
          web3.utils.asciiToHex("TOKEN-DOES-NOT-EXIST"),
          { from: trader1 }
        ),
        "this token does not exist"
      );
    });

    it("should NOT withdraw if user balance is not enough", async () => {
      await deposit();
      await expectRevert(
        dex.withdraw(web3.utils.toWei("1000"), BAT, { from: trader1 }),
        "Balance not enough."
      );
    });
  });

  describe("#createLimitOrder()", async () => {
    let buyOrder = {
      side: SIDE.BUY,
      ticker: BAT,
      amount: web3.utils.toWei("10"),
    };

    beforeEach(async () => {
      // fill trader1 balance of DAI
      await dai.approve(dex.address, web3.utils.toWei("200"), {
        from: trader1,
      });
      await dai.approve(dex.address, web3.utils.toWei("200"), {
        from: trader2,
      });
      await dex.deposit(web3.utils.toWei("200"), DAI, { from: trader1 });
      await dex.deposit(web3.utils.toWei("200"), DAI, { from: trader2 });
      await dex.createLimitOrder(
        buyOrder.side,
        buyOrder.ticker,
        buyOrder.amount,
        10,
        { from: trader1 }
      );
    });

    describe("should create a limit order", async () => {
      it("should create first buy limit order", async () => {
        let buyOrders = await dex.getOrders(BAT, SIDE.BUY);
        let sellOrders = await dex.getOrders(BAT, SIDE.SELL);
        assert.lengthOf(buyOrders, 1, "length of buyOrders should be 1");
        assert.equal(
          buyOrders[0].trader,
          trader1,
          "buy order trader sould be trader1"
        );
        assert.equal(
          buyOrders[0].ticker,
          web3.utils.padRight(BAT, 64),
          "buy order ticker should be BAT"
        );
        assert.equal(
          buyOrders[0].amount,
          web3.utils.toWei("10"),
          "buy order amount should be 10"
        );
        assert.equal(buyOrders[0].price, "10", "buy order price should be 10");
        assert.equal(buyOrders[0].filled, "0", "buy order filled should be 0");
        assert.lengthOf(sellOrders, 0, "sell orders should be empty");
      });

      it("should sort orders properly", async () => {
        await dex.createLimitOrder(
          buyOrder.side,
          buyOrder.ticker,
          buyOrder.amount,
          11,
          { from: trader2 }
        );
        await dex.createLimitOrder(
          buyOrder.side,
          buyOrder.ticker,
          buyOrder.amount,
          9,
          { from: trader1 }
        );
        buyOrders = await dex.getOrders(BAT, SIDE.BUY);
        assert.lengthOf(buyOrders, 3, "buyOrders of BAT length should be 3");
        assert.equal(
          buyOrders[0].trader,
          trader2,
          "first buy order should belong to trader 2"
        );
        assert.equal(
          buyOrders[1].trader,
          trader1,
          "second buy order should belong to trader1"
        );
        assert.equal(
          buyOrders[1].price,
          10,
          "price of second order should be 10"
        );
        assert.equal(
          buyOrders[2].trader,
          trader1,
          "third buy order should belong to trader1"
        );
        assert.equal(buyOrders[2].price, 9, "price of third order should be 9");
      });
    });

    it("should NOT create the order if token does not exist", async () => {
      await expectRevert(
        dex.createLimitOrder(
          buyOrder.side,
          web3.utils.asciiToHex("TOKEN-DOES-NOT-EXIST"),
          buyOrder.amount,
          10,
          { from: trader1 }
        ),
        "this token does not exist"
      );
    });

    it("should NOT create the order if token is DAI", async () => {
      await expectRevert(
        dex.createLimitOrder(buyOrder.side, DAI, buyOrder.amount, 10, {
          from: trader1,
        }),
        "cannot trade DAI"
      );
    });

    it("should NOT create the sell order if trader does not have enough token", async () => {
      await zrx.approve(dex.address, web3.utils.toWei("100"), {
        from: trader2,
      });
      await dex.deposit(web3.utils.toWei("100"), ZRX, { from: trader2 });
      await expectRevert(
        dex.createLimitOrder(SIDE.SELL, ZRX, web3.utils.toWei("200"), 10, {
          from: trader2,
        }),
        "NOT enough token in balance."
      );
    });

    it("should NOT create buy order if trader does not have enough DAI", async () => {
      await expectRevert(
        dex.createLimitOrder(
          buyOrder.side,
          buyOrder.ticker,
          web3.utils.toWei("30"),
          10,
          { from: trader1 }
        ),
        "DAI balance too low."
      );
    });
  });

  describe("#createMarketOrder()", async () => {
    it("should create a market order", async () => {
      await dai.approve(dex.address, web3.utils.toWei("100"), {
        from: trader1,
      });
      await dex.deposit(web3.utils.toWei("100"), DAI, { from: trader1 });
      await bat.approve(dex.address, web3.utils.toWei("200"), {
        from: trader2,
      });
      await dex.deposit(web3.utils.toWei("200"), BAT, { from: trader2 });
      await dex.createLimitOrder(SIDE.BUY, BAT, web3.utils.toWei("10"), 10, {
        from: trader1,
      });
      await dex.createMarketOrder(BAT, web3.utils.toWei("5"), SIDE.SELL, {
        from: trader2,
      });
      const balances = await Promise.all([
        dex.traderBalances(trader1, DAI),
        dex.traderBalances(trader1, BAT),
        dex.traderBalances(trader2, DAI),
        dex.traderBalances(trader2, BAT),
      ]);
      const orders = await dex.getOrders(BAT, SIDE.BUY);
      assert.equal(
        orders[0].filled,
        web3.utils.toWei("5"),
        "Buy limit order filled with 5 BAT"
      );
      assert.equal(
        balances[0],
        web3.utils.toWei("50"),
        "trader1 must have 50 DAI left in balance"
      );
      assert.equal(
        balances[1],
        web3.utils.toWei("5"),
        "trader1 must have 5 BAT in his balance"
      );
      assert.equal(
        balances[2],
        web3.utils.toWei("50"),
        "trader2 must have 50 DAI in his balance"
      );
      assert.equal(
        balances[3],
        web3.utils.toWei("195"),
        "trader2 must have 195 BAT in his balance"
      );
    });

    it("should NOT create market order if token does not exist", async () => {
      await expectRevert(
        dex.createMarketOrder(
          web3.utils.asciiToHex("TOKEN-DOES-NOT-EXIST"),
          web3.utils.toWei("10"),
          SIDE.BUY,
          { from: trader1 }
        ),
        "this token does not exist"
      );
    });

    it("should NOT create market order if token is DAI", async () => {
      await expectRevert(
        dex.createLimitOrder(SIDE.BUY, DAI, web3.utils.toWei("10"), 10, {
          from: trader1,
        }),
        "cannot trade DAI"
      );
    });

    it("should NOT create market order of seller has not enough token", async () => {
      await bat.approve(dex.address, web3.utils.toWei("100"), {
        from: trader2,
      });
      await dex.deposit(web3.utils.toWei("100"), BAT, { from: trader2 });
      await expectRevert(
        dex.createMarketOrder(BAT, web3.utils.toWei("150"), SIDE.SELL, {
          from: trader2,
        }),
        "NOT enough token in balance."
      );
    });

    it("should NOT create market order if buyer does not have enough DAI", async () => {
      await bat.approve(dex.address, web3.utils.toWei("100"), {
        from: trader2,
      });
      await dai.approve(dex.address, web3.utils.toWei("50"), {
        from: trader1,
      });
      await dex.deposit(web3.utils.toWei("100"), BAT, { from: trader2 });
      await dex.deposit(web3.utils.toWei("50"), DAI, { from: trader1 });
      await dex.createLimitOrder(SIDE.SELL, BAT, web3.utils.toWei("10"), 10, {
        from: trader2,
      });
      await expectRevert(
        dex.createMarketOrder(BAT, web3.utils.toWei("10"), SIDE.BUY, {
          from: trader1,
        }),
        "Not enough DAI in balance"
      );
    });
  });
});
