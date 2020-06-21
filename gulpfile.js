var gulp = require('gulp');

var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var Synci18n = require('sync-i18n');

var fs = require('fs');
var pluginName = "webdav-integration";

gulp.task('i18n', function (done) {
  Synci18n().generateTranslations();
  done();
});

gulp.task('prepare-package', gulp.series('i18n', function() {
  return gulp.src(['web/*.js'])
    .pipe(concat('plugin.js'))
    .pipe(uglify())
    .pipe(gulp.dest('target/'));
}));

gulp.task('i18n', function () {
  Synci18n().generateTranslations();
});

gulp.task('default', gulp.series('prepare-package'));