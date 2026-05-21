import React from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';

const SortIcon = ({ columnKey, currentKey, direction }) => {
  if (currentKey !== columnKey) return null;
  return direction === 'ascending' ? <FiChevronUp className="inline ml-1" /> : <FiChevronDown className="inline ml-1" />;
};

export default SortIcon;
