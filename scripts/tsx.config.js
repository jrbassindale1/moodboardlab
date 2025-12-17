// TSX loader config to handle image imports in Node environment
export default {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '\\.(jpg|jpeg|png|gif|webp|svg)$': './imageStub.js'
    }
  }
};
