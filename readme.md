- 将index.js 移动到想要copy的文件 目录下
- 改变index.js中 onFile('./InfoSupplier.js', './code/index.js', './InfoSupplier.js'); 第一个参数 与第三个参数 是你要想copy的文件， 第二个参数不变
- 执行node index.js
- 就会生成一个code目录，里面是 所有的依赖文件， 并且自动更换了 依赖中的引用路径
