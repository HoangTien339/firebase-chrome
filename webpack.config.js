const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv'); dotenv.config();
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const devMode = env('NODE_ENV') !== 'production';
const srcPath = env('SOURCE_PATH', 'src');
const buildPath = env('BUILD_PATH', 'build');

// Get environment variable function
function env(e, d = '') {
  if (typeof process.env[e] === 'undefined' || process.env[e] === '') return d;
  return process.env[e];
}

// Generate src/scripts/configs.[development|production].js secrets file
function generateSecretConfig() {
  const NODE_ENV = env('NODE_ENV', 'development');
  const ENV_FILE = path.join(__dirname, '.env');
  let configsPath = path.join(__dirname, `${srcPath}/scripts/configs.${NODE_ENV}.js`);
  if (!fs.existsSync(ENV_FILE)) {
    console.info('Please initialize .env (copy .env.example) before perform build.')
    process.exit()
  }
  if (!fs.existsSync(configsPath)) {
    let configs = dotenv.parse(fs.readFileSync(ENV_FILE, { encoding: 'utf-8' }));
    let content = {}
    _.forEach(configs, function(v, k) {
      content[_.camelCase(k)] = v;
    });
    content = JSON.stringify(content, undefined, 2);
    content = `export default ${content};`;
    fs.writeFileSync(configsPath, content);
  }
  return {
    configs: configsPath
  }
}

let aliasConfigs = generateSecretConfig();

module.exports = () => {
  return {
    mode: env('NODE_ENV', 'development'),
    target: 'web',
    entry: {
      popup: path.join(__dirname, `${srcPath}/scripts/popup.js`),
      options: path.join(__dirname, `${srcPath}/scripts/options.js`),
      background: path.join(__dirname, `${srcPath}/scripts/background.js`),
      content_scripts: path.join(__dirname, `${srcPath}/scripts/content_scripts.js`),
    },
    output: {
      filename: devMode ? 'js/[name].js' : 'js/[name].[hash].js',
      path: path.resolve(__dirname, buildPath)
    },
    resolve: {
      alias: Object.assign({
        vue: 'vue/dist/vue.js'
      }, aliasConfigs)
    },
    devtool: devMode ? 'inline-source-map' : false,
    module: {
      rules: [
      {
        test: /\.(js)$/,
        loader: 'eslint-loader'
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          },
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'images/'
          }
        }]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'fonts',
          }
        }]
      }
      ]
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            name: 'vendors',
            minChunks: 1,
            minSize: 1000,
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all'
          }
        }
      }
    },
    plugins: [
      new CleanWebpackPlugin([path.resolve(__dirname, `${buildPath}`)]),
      new MiniCssExtractPlugin({ filename: devMode ? 'css/[name].css' : 'css/[name].[hash].css' }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, `${srcPath}/popup.html`),
        filename: 'popup.html',
        chunks: ['popup', 'vendors']
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, `${srcPath}/options.html`),
        filename: 'options.html',
        chunks: ['options', 'vendors']
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, `${srcPath}/background.html`),
        filename: 'background.html',
        chunks: ['background', 'vendors']
      }),
      new CopyWebpackPlugin([
        { from: `images`, to: `img` },
        { from: `manifest.json`, to: `manifest.json` }
      ], { context: srcPath }),
      new ManifestPlugin({
        maps: ['vendors.js', 'content_scripts.js'],
        manifest: 'manifest.json'
      })
    ]
  };
};

function ManifestPlugin(options = {}) {
  this.options = Object.assign({}, options)
}

ManifestPlugin.prototype.apply = function (compiler) {
  compiler.hooks.afterEmit.tap('ManifestPlugin', (compilation) => {
    let buildPath = compilation.outputOptions.path;
    let assets = compilation.assets;
    let mapNames = [];
    for (let item in assets) {
      let result = _.find(this.options.maps, val => {
        // ?= positive lookahead. Ex: 'vendors.js' => 'vendors.*\.js$'
        let reg = new RegExp(`${val.replace(/\.(?=[^.]*$)/, '.*\.')}$`);
        return reg.test(item);
      });

      if (result != undefined) {
        mapNames.push(item);
      }
    }

    let manifestPath = path.join(buildPath, this.options.manifest);

    if (assets[this.options.manifest] !== undefined) {
      let obj = JSON.parse(assets[this.options.manifest].source().toString('utf-8'));
      obj.content_scripts[0].js = mapNames

      fs.writeFileSync(manifestPath, JSON.stringify(obj, null, 2));
    }
  });
}
