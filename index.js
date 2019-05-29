const fs = require('fs');
const pathModule = require('path');
const babel = require('@babel/core');
const readline = require('readline');
const fileCache = { index: 1 };
// 删除文件夹
function rmdirp(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  let files = fs.readdirSync(dir);
  files.forEach(file => {
    let current = dir + '/' + file;
    let child = fs.statSync(current);
    if (child.isDirectory()) {
      rmdirp(current);
    } else {
      fs.unlinkSync(current);
    }
  });
  fs.rmdirSync(dir);
}
// 创建文件夹
function mkdirp(dir) {
  let paths = dir.split('/');
  !(function next(index) {
    if (index > paths.length) return;
    let current = paths.slice(0, index).join('/');
    fs.access(current, fs.constants.R_OK, err => {
      if (err) {
        fs.mkdir(current, 0o666, next.bind(null, index + 1));
      } else {
        next(index + 1);
      }
    });
  })(1);
}
rmdirp('code');
mkdirp('code');
function babelCode(code) {
  let filesPath = [];
  const visitor = {
    ImportDeclaration(path, ref = { opts: {} }) {
      let node = path.node;
      let writeFileName = '';
      let fileName = pathModule.basename(node.source.value); // 拿import引入路径下的文件名
      if (
        node.source.value.includes('/') &&
        !node.source.value.includes('umi') &&
        !node.source.value.includes('dva') &&
        !node.source.value.includes('nzh') &&
        !node.source.value.includes('lodash-decorators') &&
        !node.source.value.includes('ant-design-pro') &&
        !node.source.value.includes('utils/authority')
      ) {
        // 文件重名
        if (fileCache[fileName]) {
          writeFileName = `./code/hash${Math.random().toFixed(7) * 10000000}${fileName}`;
          fileCache[fileName] = 1;
        } else {
          writeFileName = `./code/${fileName}`;
          fileCache[fileName] = 1;
        }
        // @ 做转换
        // 修改import引入关系
        // 返回存储了 imoprt依赖的数组
        if (node.source.value.includes('@')) {
          filesPath.push({
            path: node.source.value.replace(
              '@',
              `${__dirname.substring(0, __dirname.indexOf('src'))}src`
            ),
            fileName: writeFileName,
          });
        } else {
          filesPath.push({ path: node.source.value, fileName: writeFileName });
        }
        node.source.value = `./${fileName}`;
      }
    },
  };

  const r = babel.transform(code, {
    plugins: [{ visitor }],
  });

  return { code: r.code, filesPath };
}
function onFile(path, fileName, parentPath) {
  //console.log('file---------------------------------', path, fileName, parentPath);
  let path1 = path;
  let fileName1 = fileName;
  if (!fs.existsSync(path)) {
    // 文件不存在 加.js 再次验证
    path += '.js';
    fileName += '.js';
    if (!fs.existsSync(path)) {
      path = path1 + '.ts';
      fileName = fileName1 + '.ts';
      if (!fs.existsSync(path)) {
        path = path1 + '.tsx';
        fileName = fileName1 + '.tsx';
        if (!fs.existsSync(path)) {
          throw `异常：${parentPath} 引用的 ${path} 文件不存在`;
        }
      }
    }
  }
  if (fs.statSync(path).isDirectory()) {
    // 是文件夹 加/index.js， 生成的文件为文件夹名.js
    path += '/index.js';
    fileName += '.js';
  }
  console.log(path, fileName);
  let str = '';
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    crlfDelay: Infinity,
  });
  let arr = [];
  rl.on('line', line => {
    // 一行行读取
    arr.push(line.includes('from') && line.includes('import'));
  }).on('close', () => {
    let strIndex = 0;
    let flagIndex = 0;
    let importIndex = 0;
    let res = { code: '', filesPath: [] };
    // 取反  找到 为true哪一个的index
    let arrBool = arr.reverse().find((item, index) => {
      strIndex = index;
      return item;
    });
    // 找到取反前最后一个为true的 index
    if (arrBool) {
      // less文件 为undefined,  不用调用babelCode方法
      importIndex = arr.length - strIndex;
    }
    const newrl = readline.createInterface({
      input: fs.createReadStream(path),
      crlfDelay: Infinity,
    });
    newrl
      .on('line', line => {
        // 一行行读这个文件， 读到没有import的时候 就传入到babelCode函数
        str += line + '\n';
        if (++flagIndex === importIndex) {
          res = babelCode(str);
          str = res.code + '\n';
        }
      })
      .on('close', () => {
        fs.writeFileSync(fileName, str, {
          encoding: 'utf8',
          flag: 'a',
          mode: 0o666,
        });
        // 拿到生成的 依赖路径和文件名
        if (res.filesPath.length > 0) {
          res.filesPath.forEach(item => {
            if (path === parentPath || pathModule.isAbsolute(item.path)) {
              onFile(item.path, item.fileName, path);
            } else {
              onFile(
                // 解决依赖关系
                pathModule.resolve(require.resolve(path), `../${item.path}`),
                item.fileName,
                path
              );
            }
          });
        }
      });
  });
}
onFile('./ProductDetailt.tsx', './code/index.js', './ProductDetailt.tsx');
