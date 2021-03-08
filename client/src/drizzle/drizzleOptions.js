import DexContract from "../contracts/Dex.json";

const options = {
  contracts: [DexContract],
  events: {
    Dex: ["NewTrade"],
  },
  web3: {
    fallback: {
      type: "ws",
      url: "ws://127.0.0.1:7545",
    },
  },
  networkWhiteList: [
    42, // Kovan
  ],
};

export default options;
