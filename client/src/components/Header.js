import React from "react";
import DropDown from "./common/DropDown";
import PropTypes from "prop-types";

const Header = ({
  dexAddress,
  selectedToken,
  tokens,
  onSelect,
  onSeedToken,
}) => {
  return (
    <header id="header" className="card">
      <div className="row">
        <div className="col-sm-3 flex">
          <DropDown
            items={tokens.map((token) => ({
              label: token.ticker,
              value: token,
            }))}
            activeItem={{
              label: selectedToken.ticker,
              value: selectedToken,
            }}
            onSelect={onSelect}
          />
        </div>
        <div className="col-sm-6">
          <h1 className="header-title">
            Dex -{" "}
            <span className="contract-address">
              Contract address: <span className="address">{dexAddress}</span>
            </span>
          </h1>
        </div>
        {selectedToken.ticker !== "DAI" && (
          <div className="col-sm-3 text-right">
            <button className="btn btn-primary" onClick={onSeedToken}>
              Faucet
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

Header.propTypes = {
  dexAddress: PropTypes.string.isRequired,
  selectedToken: PropTypes.object,
  tokens: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default Header;
