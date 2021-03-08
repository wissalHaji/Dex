const Bat = artifacts.require("Bat");
const Dai = artifacts.require("Dai");
const Zrx = artifacts.require("Zrx");
const Rep = artifacts.require("Rep");

const Dex = artifacts.require("Dex");

const [BAT, DAI, ZRX, REP] = ["BAT", "DAI", "ZRX", "REP"].map((ticker) =>
  web3.utils.asciiToHex(ticker)
);

const SIDE = {
  BUY: 0,
  SELL: 1,
};

module.exports = async (deployer, network, accounts) => {
  if (network === "development" || network === "kovan") {
    const [, trader1, trader2, trader3, trader4] = accounts;
    const amount = web3.utils.toWei("1000");

    await Promise.all(
      [Bat, Dai, Zrx, Rep, Dex].map((contract) => deployer.deploy(contract))
    );
    const [bat, dai, zrx, rep, dex] = await Promise.all(
      [Bat, Dai, Zrx, Rep, Dex].map((contract) => contract.deployed())
    );

    await Promise.all([
      dex.addToken(BAT, bat.address),
      dex.addToken(DAI, dai.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);

    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount, { from: trader });
      await token.approve(dex.address, amount, { from: trader });
      const ticker = await token.symbol();
      await dex.deposit(amount, web3.utils.asciiToHex(ticker), {
        from: trader,
      });
    };
    await Promise.all(
      [dai, bat, rep, zrx].map(async (token) => {
        await seedTokenBalance(token, trader1);
        await seedTokenBalance(token, trader2);
        await seedTokenBalance(token, trader3);
        await seedTokenBalance(token, trader4);
      })
    );

    const increaseTime = async (seconds) => {
      await web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [seconds],
          id: 0,
        },
        () => {}
      );
      await web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          params: [],
          id: 0,
        },
        () => {}
      );
    };

    //create trades
    await dex.createLimitOrder(SIDE.BUY, BAT, 1000, 10, { from: trader1 });
    await dex.createMarketOrder(BAT, 1000, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, BAT, 1200, 11, { from: trader1 });
    await dex.createMarketOrder(BAT, 1200, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, BAT, 1200, 15, { from: trader1 });
    await dex.createMarketOrder(BAT, 1200, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, BAT, 1500, 14, { from: trader1 });
    await dex.createMarketOrder(BAT, 1500, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, BAT, 2000, 12, { from: trader1 });
    await dex.createMarketOrder(BAT, 2000, SIDE.SELL, { from: trader2 });

    await dex.createLimitOrder(SIDE.BUY, REP, 1000, 2, { from: trader1 });
    await dex.createMarketOrder(REP, 1000, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, REP, 500, 4, { from: trader1 });
    await dex.createMarketOrder(REP, 500, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, REP, 800, 2, { from: trader1 });
    await dex.createMarketOrder(REP, 800, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, REP, 1200, 6, { from: trader1 });
    await dex.createMarketOrder(REP, 1200, SIDE.SELL, { from: trader2 });

    await dex.createLimitOrder(SIDE.BUY, ZRX, 900, 2, { from: trader1 });
    await dex.createMarketOrder(ZRX, 900, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, ZRX, 1200, 4, { from: trader1 });
    await dex.createMarketOrder(ZRX, 1200, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, ZRX, 450, 2, { from: trader1 });
    await dex.createMarketOrder(ZRX, 450, SIDE.SELL, { from: trader2 });
    await increaseTime(1);
    await dex.createLimitOrder(SIDE.BUY, ZRX, 800, 6, { from: trader1 });
    await dex.createMarketOrder(ZRX, 800, SIDE.SELL, { from: trader2 });

    //create orders
    await Promise.all([
      dex.createLimitOrder(SIDE.BUY, BAT, 1200, 11, { from: trader2 }),
      dex.createLimitOrder(SIDE.BUY, BAT, 1000, 12, { from: trader2 }),

      dex.createLimitOrder(SIDE.BUY, BAT, 1400, 10, { from: trader1 }),
      dex.createLimitOrder(SIDE.BUY, REP, 2000, 5, { from: trader1 }),
      dex.createLimitOrder(SIDE.BUY, REP, 500, 6, { from: trader2 }),

      dex.createLimitOrder(SIDE.BUY, REP, 3000, 4, { from: trader1 }),
      dex.createLimitOrder(SIDE.BUY, ZRX, 3000, 13, { from: trader1 }),
      dex.createLimitOrder(SIDE.BUY, ZRX, 500, 14, { from: trader2 }),

      dex.createLimitOrder(SIDE.BUY, ZRX, 4000, 12, { from: trader1 }),
      dex.createLimitOrder(SIDE.SELL, BAT, 3000, 15, { from: trader4 }),
      dex.createLimitOrder(SIDE.SELL, BAT, 500, 14, { from: trader4 }),

      dex.createLimitOrder(SIDE.SELL, BAT, 2000, 16, { from: trader3 }),
      dex.createLimitOrder(SIDE.SELL, REP, 2000, 9, { from: trader3 }),
      dex.createLimitOrder(SIDE.SELL, REP, 800, 8, { from: trader4 }),

      dex.createLimitOrder(SIDE.SELL, REP, 4000, 10, { from: trader3 }),
      dex.createLimitOrder(SIDE.SELL, ZRX, 1500, 23, { from: trader3 }),
      dex.createLimitOrder(SIDE.SELL, ZRX, 1200, 22, { from: trader3 }),
      dex.createLimitOrder(SIDE.SELL, ZRX, 900, 21, { from: trader4 }),
    ]);
  }
};
