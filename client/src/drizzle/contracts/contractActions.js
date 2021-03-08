import * as types from "./constants";

export function syncContract(contract) {
  return { type: types.CONTRACT_SYNCING, contract };
}
