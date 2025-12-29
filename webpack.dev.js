const { merge } = require('webpack-merge');
const common = require('./webpack.common');
module.exports = merge(common, { 
    mode: 'development', 
    devtool: 'inline-source-map', 
    devServer: { 
        static: './dist', 
        open: true,
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:3001',
                changeOrigin: true,
            }
        ]
    } 
});