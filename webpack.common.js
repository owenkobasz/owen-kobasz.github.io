const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: { filename: 'main.[contenthash].js', path: path.resolve(__dirname, 'dist'), clean: true, assetModuleFilename: 'imgs/[name].[contenthash][ext]' },
    module: {
        rules: [
            { test: /\.html$/i, loader: 'html-loader' },
            { test: /\.s?css$/, use: [
                require('mini-css-extract-plugin').loader,
                'css-loader',
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            silenceDeprecations: ['import']
                        }
                    }
                }
            ] },
            { test: /\.(png|jpe?g|svg|gif)$/i, type: 'asset/resource' },
            { test: /\.pdf$/i, type: 'asset/resource', generator: { filename: 'files/[name].[contenthash][ext]' } },
            { test: /\.(woff|woff2|eot|ttf|otf)$/i, type: 'asset/resource', generator: { filename: 'fonts/[name].[contenthash][ext]' } },
        ]
    },
    plugins: [
        new (require('mini-css-extract-plugin'))({ filename: 'main.[contenthash].css' }),
        new HtmlWebpackPlugin({ template: 'src/template.html' }),
        new ImageMinimizerPlugin({
            minimizer: {
                implementation: ImageMinimizerPlugin.imageminMinify,
                options: {
                    plugins: [
                        ['imagemin-mozjpeg', { quality: 72, progressive: true }],
                        ['imagemin-pngquant', { quality: [0.6, 0.8] }]
                    ]
                }
            }
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'CNAME', to: '' },
                { from: 'src/assets/fav.png', to: 'assets/fav.png' },
                { from: 'src/assets/menu.svg', to: 'assets/menu.svg', noErrorOnMissing: true },
                { from: 'src/assets/blog', to: 'assets/blog', noErrorOnMissing: true }
            ]
        })
    ]
};