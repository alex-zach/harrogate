var Config, Path, exec;

exec = require('child_process').exec;

Path = require('path');

Fs = require('fs');

Config = require_harrogate_module('config.js');

module.exports = {
  compile: function(project_resource, cb) {
    project_resource.src_directory.is_valid().then(function(valid) {
      if (!valid) {
        throw new ServerError(404, 'Project ' + project_resource.name + ' does not contain any source files');
      }
      return project_resource.src_directory.get_children();
    }).then(function(src_files) {
      let promises = [];
      src_files.forEach((file) => {
        if (Path.basename(file.path).charAt(0) === '.') {
          return;
        }
        let cmd;
        if (Path.extname(file.name) === '.c') {
          cmd = 'gcc';
        }
        else if (Path.extname(file.name) === '.cpp') {
          cmd = 'g++';
        }
        cmd += ` -I"${project_resource.include_directory.path}" -I"${Config.ext_deps.include_path}" -L"${Config.ext_deps.lib_path}" -Wall -c "${file.path}" -o "${Path.join(project_resource.bin_directory.path, file.name)}.o"`;

        promises.push(new Promise((resolve) => exec(cmd, (error, stdout, stderr) => {
          resolve({file: file.name, error, stdout, stderr});
        })));
      });

      Promise.all(promises).then(fileoutputs => {
        let can_link = true;
        fileoutputs.forEach(el => {
          if (el.error) {
            can_link = false;
          }
        });
        if (can_link) {
          let cmd = `g++ -lwallaby -lm -o "${project_resource.binary.path}"`;
          Fs.readdirSync(project_resource.bin_directory.path).forEach(el => {
            cmd += ` "${Path.join(project_resource.bin_directory.path, el)}"`;
          });
          exec(cmd, (error, stdout, stderr) => {
            cb({linking: {error, stdout, stderr}, fileoutputs});
          });
        } else {
          cb({fileoutputs});
        }
      });
    })["catch"](function(e) {
      cb(e);
    }).done();
  }
};
