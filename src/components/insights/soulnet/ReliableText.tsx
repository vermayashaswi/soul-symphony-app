
import React from 'react';
import SimpleText from './SimpleText';

interface ReliableTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  maxWidth?: number;
}

export const ReliableText: React.FC<ReliableTextProps> = (props) => {
  return <SimpleText {...props} />;
};

export default ReliableText;
