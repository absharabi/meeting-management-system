const fs = require('fs');
const path = require('path');

const walk = function(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          if (file.includes('node_modules') || file.includes('.next')) return next();
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
          }
          next();
        }
      });
    })();
  });
};

walk('client', function(err, results) {
  if (err) throw err;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace 'http://localhost:5000...' with `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}...`
    content = content.replace(/'http:\/\/localhost:5000(.*?)'/g, "`\\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}$1`");
    // Replace "http://localhost:5000..."
    content = content.replace(/"http:\/\/localhost:5000(.*?)"/g, "`\\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}$1`");
    // Replace `http://localhost:5000...`
    content = content.replace(/`http:\/\/localhost:5000(.*?)`/g, "`\\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}$1`");

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated: ' + file);
    }
  });
});
