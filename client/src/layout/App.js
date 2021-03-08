import React, { useEffect, useState } from "react";
import Header from "../components/Header";

import { connect } from "react-redux";
import { useDrizzleContext } from "../drizzle/drizzleContext";
import Footer from "../components/Footer";
import NewOrder from "../components/NewOrder";
import AllOrders from "../components/AllOrders";
import MyOrders from "../components/MyOrders";
import AllTrades from "../components/AllTrades";
import Wallet from "../components/Wallet";
import MockERC20 from "../contracts/MockERC20.json";
import { syncContract } from "../drizzle/contracts/contractActions";

import { SIDE } from "../constants";

function App({ account, contracts, syncContract, newTrades }) {
  const drizzle = useDrizzleContext();
  const dexContract = drizzle.contracts.Dex;

  const [user, setUser] = useState({
    account,
    selectedToken: {},
    balances: {
      tokenDex: 0,
      tokenWallet: 0,
    },
  });
  const [tokens, setTokens] = useState([]);
  const [tokenDexBalanceCacheKey, setTokenDexBalanceCacheKey] = useState(null);
  const [tokenWalletBalanceCacheKey, setTokenWalletBalanceCacheKey] = useState(
    null
  );
  const [ordersCacheKey, setOrdersCacheKey] = useState({
    sell: null,
    buy: null,
  });
  const [orders, setOrders] = useState({ buy: [], sell: [] });
  const [trades, setTrades] = useState([]);
  const [errors, setErrors] = useState([]);

  // get tokens list
  useEffect(() => {
    const init = async () => {
      const rawTokens = await dexContract.methods.getTokens().call();
      const tokens = rawTokens.map((token) => ({
        ...token,
        ticker: drizzle.web3.utils.hexToUtf8(token.ticker),
      }));
      setTokens(tokens);
    };
    init();
  }, []);

  // watch for NewTrade event
  useEffect(() => {
    if (newTrades.length > 0) {
      const position = newTrades.length - 1;
      setTrades((prevState) => [
        ...prevState,
        newTrades[position].returnValues,
      ]);
    }
  }, [newTrades]);

  // set selected token + handle its change
  // when selected token changes we need:
  // 1. to update dex balance + wallet balance
  // 2. get the token buy and sell orders
  // 3. get token trades
  useEffect(() => {
    if (tokens.length === 0) return;
    const tokenSelected = Object.keys(user.selectedToken).length !== 0;
    const selectedToken = tokenSelected ? user.selectedToken : tokens[0];
    // start call to get user's buy orders
    const buyOrdersCacheKey = dexContract.methods.getOrders.cacheCall(
      drizzle.web3.utils.utf8ToHex(selectedToken.ticker),
      SIDE.BUY
    );
    // start call to get user's sell orders
    const sellOrdersCacheKey = dexContract.methods.getOrders.cacheCall(
      drizzle.web3.utils.utf8ToHex(selectedToken.ticker),
      SIDE.SELL
    );
    // start call to get user's dex balance
    const tokenDexBalanceCacheKey = dexContract.methods.traderBalances.cacheCall(
      user.account,
      drizzle.web3.utils.utf8ToHex(selectedToken.ticker)
    );
    // add the token contract if it does not exist
    if (!drizzle.contracts[selectedToken.tokenAddress]) {
      const contractConfig = {
        contractName: selectedToken.tokenAddress,
        web3Contract: new drizzle.web3.eth.Contract(
          MockERC20.abi,
          selectedToken.tokenAddress
        ),
      };
      drizzle.addContract(contractConfig);
    }
    // start call to get user's balance from the token
    const tokenWalletBalanceCacheKey = drizzle.contracts[
      selectedToken.tokenAddress
    ].methods.balanceOf.cacheCall(user.account);

    setOrdersCacheKey({ buy: buyOrdersCacheKey, sell: sellOrdersCacheKey });
    setTokenDexBalanceCacheKey(tokenDexBalanceCacheKey);

    if (!tokenSelected) {
      setUser((prevState) => ({ ...prevState, selectedToken }));
      // this key depend only on the user account
      // and they won't change if the selected token changes
      console.log("wallet balance cache key : " + tokenWalletBalanceCacheKey);
      setTokenWalletBalanceCacheKey(tokenWalletBalanceCacheKey);
    } else {
      // If balances calls result are already available in
      // the cache: Should manually update user balances
      updateUserTokenBalance();
    }
    getTrades(selectedToken).then((trades) => setTrades(trades));
  }, [user.selectedToken, user.account, tokens]);

  // watch for dex balance call result
  useEffect(() => {
    const dexBalanceCache =
      contracts.Dex.traderBalances[tokenDexBalanceCacheKey];
    if (dexBalanceCache) {
      if (dexBalanceCache.value) {
        setUser((prevSate) => ({
          ...prevSate,
          balances: {
            ...prevSate.balances,
            tokenDex: dexBalanceCache.value,
          },
        }));
      } else if (dexBalanceCache.error) {
        setErrors((prevState) => [...prevState, dexBalanceCache.error]);
      }
    }
  }, [
    tokenDexBalanceCacheKey,
    contracts.Dex.traderBalances[tokenDexBalanceCacheKey],
  ]);

  // watch for token balance call result
  useEffect(() => {
    if (contracts[user.selectedToken.tokenAddress]) {
      const tokenBalanceCache =
        contracts[user.selectedToken.tokenAddress].balanceOf[
          tokenWalletBalanceCacheKey
        ];
      if (tokenBalanceCache) {
        if (tokenBalanceCache.value) {
          setUser((prevState) => ({
            ...prevState,
            balances: {
              ...prevState.balances,
              tokenWallet: tokenBalanceCache.value,
            },
          }));
        } else if (tokenBalanceCache.error) {
          setErrors((prevState) => [...prevState, tokenBalanceCache.error]);
        }
      }
    }
  }, [tokenWalletBalanceCacheKey, contracts]);

  // watch for orders call result
  useEffect(() => {
    // buy orders
    if (contracts.Dex.getOrders[ordersCacheKey.buy]) {
      const buyOrdersCache = contracts.Dex.getOrders[ordersCacheKey.buy];
      if (buyOrdersCache.value) {
        setOrders((prevSate) => ({ ...prevSate, buy: buyOrdersCache.value }));
      } else if (buyOrdersCache.error) {
        setErrors((prevState) => [...prevState, buyOrdersCache.error]);
      }
    }

    if (contracts.Dex.getOrders[ordersCacheKey.sell]) {
      const sellOrdersCache = contracts.Dex.getOrders[ordersCacheKey.sell];
      if (contracts.Dex.getOrders[ordersCacheKey.sell].value) {
        setOrders((prevSate) => ({
          ...prevSate,
          sell: sellOrdersCache.value,
        }));
      } else if (contracts.Dex.getOrders[ordersCacheKey.sell].error) {
        setErrors((prevState) => [...prevState, sellOrdersCache.error]);
      }
    }
  }, [ordersCacheKey, contracts.Dex.getOrders]);

  // when balances need to be updated manually
  // and filled from the cache
  const updateUserTokenBalance = () => {
    const tokenContract = contracts[user.selectedToken.tokenAddress];
    if (
      tokenContract &&
      tokenContract.balanceOf[tokenWalletBalanceCacheKey] &&
      tokenContract.balanceOf[tokenWalletBalanceCacheKey].value
    ) {
      setUser((prevState) => ({
        ...prevState,
        balances: {
          ...prevState.balances,
          tokenWallet:
            tokenContract.balanceOf[tokenWalletBalanceCacheKey].value,
        },
      }));
    }
  };

  // fetch previous trades from the blockchain
  const getTrades = async (selectedToken) => {
    const dexWeb3Contract = new drizzle.web3.eth.Contract(
      dexContract.abi,
      dexContract.address
    );
    const events = await dexWeb3Contract.getPastEvents("NewTrade", {
      fromBlock: 0,
      filter: { ticker: drizzle.web3.utils.utf8ToHex(selectedToken.ticker) },
    });
    return events.map((event) => event.returnValues);
  };

  const onSelectToken = (token) => {
    setUser((prevState) => ({ ...prevState, selectedToken: token }));
  };

  const deposit = async (amount) => {
    try {
      await drizzle.contracts[user.selectedToken.tokenAddress].methods
        .approve(dexContract.options.address, amount)
        .send({ from: user.account, gas: 50000 });
      await dexContract.methods
        .deposit(
          amount,
          drizzle.web3.utils.utf8ToHex(user.selectedToken.ticker)
        )
        .send({ from: user.account, gas: 80000 });
      // manually syncing token contract
      // dex contract will be automatically synced since
      // it's the receipient of the second transaction
      syncContract(drizzle.contracts[user.selectedToken.tokenAddress]);
    } catch (error) {
      console.log(error);
    }
  };

  const withdraw = async (amount) => {
    try {
      await dexContract.methods
        .withdraw(
          amount,
          drizzle.web3.utils.utf8ToHex(user.selectedToken.ticker)
        )
        .send({ from: user.account, gas: 80000 });
      // manually syncing token contract
      syncContract(drizzle.contracts[user.selectedToken.tokenAddress]);
    } catch (error) {
      console.log(error);
    }
  };

  const createMarketOrder = async (amount, side) => {
    try {
      await dexContract.methods
        .createMarketOrder(
          drizzle.web3.utils.utf8ToHex(user.selectedToken.ticker),
          amount,
          side
        )
        .send({ from: user.account, gas: 600000 });
    } catch (error) {
      console.log(error);
    }
  };

  const createLimitOrder = async (amount, price, side) => {
    try {
      await dexContract.methods
        .createLimitOrder(
          side,
          drizzle.web3.utils.utf8ToHex(user.selectedToken.ticker),
          amount,
          price
        )
        .send({ from: user.account, gas: 400000 });
    } catch (error) {
      console.log(error);
    }
  };

  const onSeedToken = () => {
    // seed token with one unit
    drizzle.contracts[user.selectedToken.tokenAddress].methods
      .faucet(user.account, drizzle.web3.utils.toWei("1"))
      .send({ from: user.account, gas: 50900 })
      .catch((error) => {
        console.log(error);
      });
  };

  if (errors.length !== 0) throw errors;

  return (
    <div>
      <Header
        dexAddress={dexContract.address}
        selectedToken={user.selectedToken}
        tokens={tokens}
        onSelect={onSelectToken}
        onSeedToken={onSeedToken}
      />
      <main className="container-fluid">
        <div className="row">
          <div className="col-sm-4 first-col">
            <Wallet deposit={deposit} withdraw={withdraw} user={user} />
            {user.selectedToken.ticker !== "DAI" && (
              <NewOrder
                createLimitOrder={createLimitOrder}
                createMarketOrder={createMarketOrder}
              />
            )}
          </div>
          {user.selectedToken.ticker !== "DAI" && (
            <div className="col-sm-8">
              <AllTrades trades={trades} />
              <AllOrders orders={orders} />
              <MyOrders
                orders={{
                  buy: orders.buy.filter(
                    (order) =>
                      order.trader.toLowerCase() === account.toLowerCase()
                  ),
                  sell: orders.sell.filter(
                    (order) =>
                      order.trader.toLowerCase() === account.toLowerCase()
                  ),
                }}
              />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

App.propTypes = {};

const mapStateToProps = (state) => {
  return {
    account: state.accounts[0],
    contracts: state.contracts,
    newTrades: state.contracts.Dex.events,
  };
};

const mapDispatchToProps = {
  syncContract,
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
