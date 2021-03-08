import React, { useState } from "react";

import PropTypes from "prop-types";

const DropDown = ({ activeItem, onSelect, items }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const selectItem = (e, item) => {
    e.preventDefault();
    setDropdownVisible(!dropdownVisible);
    onSelect(item);
  };

  return (
    <div className="dropdown ml-3">
      <button
        className="btn btn-secondary dropdown-toggle"
        type="button"
        onClick={() => setDropdownVisible(!dropdownVisible)}
      >
        {activeItem.label}
      </button>
      <div className={`dropdown-menu ${dropdownVisible ? "visible" : ""}`}>
        {items &&
          items.map((item, i) => (
            <a
              className={`dropdown-item ${
                item.value === activeItem.value ? "active" : null
              }`}
              href="#"
              key={i}
              onClick={(e) => selectItem(e, item.value)}
            >
              {item.label}
            </a>
          ))}
      </div>
    </div>
  );
};

DropDown.propTypes = {
  activeItem: PropTypes.object,
  items: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default DropDown;
