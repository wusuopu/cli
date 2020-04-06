import {createContext, useContext} from 'react';

export const LIGHT_STYLES = {
  background: '',
  text: '',
  primary: '',
};

export const DARK_STYLES = {};

const ThemeContext = createContext(LIGHT_STYLES);

const useTheme = useContext(ThemeContext);

export {ThemeContext, useTheme};
