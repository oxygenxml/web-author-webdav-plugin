var gulp = require('gulp');

var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var fs = require('fs');
var transformer = require('gulp-convert');
var pluginName = "webdav-integration";
var translationsInjector = "0translation";

gulp.task('prepare-package', ['make-translations'], function() {
  return gulp.src([
    'web/' + translationsInjector + '.js',
    'web/autosave.js',
    'web/plugin.js'
  ])
    .pipe(concat('plugin.js'))
    .pipe(uglify())
    .pipe(gulp.dest('target/'));
});




gulp.task('make-translations', ['concat-js', 'concat-java', 'translation-xml-to-json'], function () {

  var tagsFromJava = extractTags('server'), // gets the TranslationTags properties used, not the actual tags.
    tagsFromJs = extractTags('client'),
    msgsFilled = {},
    i = 0;

  var final_translation_xml = '';

  var tagObjectsFromXML = JSON.parse(fs.readFileSync('target/translation.json', 'utf8')).translation.key;
  var tagsFromXML = [];

  // Check if translation.xml contains any unused tags.
  for (i = 0; i < tagObjectsFromXML.length; i++) {
    var trObj = tagObjectsFromXML[i];

    var tag = trObj.value[0];

    // same tag might be used on client AND server-side.
    if (tagsFromJs.indexOf(tag) !== -1) {
      // If it's a client-side tag, add it to the add translations js file.
      trObj.val.forEach( function (trObj) {
        var lang = trObj.lang[0];
        var message = trObj._;
        if (!msgsFilled[tag]) {
          msgsFilled[tag] = {};
        }
        // remove newlines and tabs.
        message = message.replace(/\r?\n\|\r/g, '').replace(/\s\s+/g, ' ');
        msgsFilled[tag][lang] = message;
      })
    }
    if(tagsFromJava.indexOf(tag.toUpperCase()) !== -1) {
      final_translation_xml += makeXmlEntry(tag, trObj);
    }
    if (tagsFromJava.indexOf(tag.toUpperCase()) == -1 && tagsFromJs.indexOf(tag) == -1) {
      // unused - neither client-side, nor server-side tag
      console.log('unused tag ', tag);
    }
    tagsFromXML.push(tag.toUpperCase());
  }

  // Check if any tags are missing from the translation.xml.
  checkForUntranslatedTags(tagsFromJs.concat(tagsFromJava), tagsFromXML);

  // Write the js that adds client-side translations
  var addTranslations = "/** This file is generated from gulp compile. \n" +
    " * It adds the client-side translations (extracted from translation.xml) **/\n\n" +
    "(function() {  " +
    "var translations = " + JSON.stringify(msgsFilled) + ";" +
    "sync.Translation.addTranslations(translations); })();";
  fs.writeFileSync('web/' + translationsInjector + '.js', addTranslations, 'utf-8');

  // Write the final translation.xml to the target/i18n folder.
  finalizeTargetXml(final_translation_xml);
});

var checkForUntranslatedTags = function (tagsUsed, tagsFromXML) {
  var diff = tagsUsed.filter(function(x) {
    return (tagsFromXML.indexOf(x) < 0 || tagsFromXML.indexOf(x.toUpperCase()) < 0);
  });
  if (diff.length !== 0) {
    console.log('client: ' + diff.length + ' tags without translation, ', diff);
  }
};

var finalizeTargetXml = function (xmlContent) {
  var toAddToXML =
    '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
    '<translation>\r\n' +
    '    <languageList>\r\n' +
    '        <language description="English" lang="en_US" localeDescription="English"/>\r\n' +
    '        <language description="German" lang="de_DE" localeDescription="Deutsch"/>\r\n' +
    '        <language description="French" lang="fr_FR" localeDescription="Français"/>\r\n' +
    '        <language description="Japanese" lang="ja_JP" localeDescription="日本語"/>\r\n' +
    '        <language description="Dutch" lang="nl_NL" localeDescription="Nederlands"/>\r\n' +
    '    </languageList>\r\n';

  xmlContent = toAddToXML + xmlContent + '</translation>';
  if(fs.existsSync('target/i18n') === false) {
    fs.mkdirSync('target/i18n');
  }
  fs.writeFileSync('target/i18n/translation.xml', xmlContent, 'utf-8');
};

var extractTags = function (tagsType) {
  var fileExt, regex, regexTrim;

  if (tagsType == 'client') {
    fileExt = 'js';
    regex = /msgs.[A-Za-z|\_]+/g;
    regexTrim = 'msgs.';
  } else if (tagsType == 'server') {
    fileExt = 'java';
    regex = /rb.getMessage\(TranslationTags.[A-Za-z|\_]+/g;
    regexTrim = 'rb.getMessage(TranslationTags.';
  }

  var fromFile = fs.readFileSync('target/plugin.translation.' + fileExt, 'utf-8');
  var tagsFromFile = fromFile.match(regex); // /msgs.[A-Za-z|\_]+/g
  var i;

  for (i = 0; i < tagsFromFile.length; i++) {
    tagsFromFile[i] = tagsFromFile[i].replace(regexTrim, '');
  }

  // remove duplicates
  tagsFromFile = tagsFromFile.filter(function(item, pos) {
    return tagsFromFile.indexOf(item) == pos;
  });

  fs.writeFileSync('target/' + pluginName + '.' + tagsType + '.tags.js', tagsFromFile, 'utf-8');

  return tagsFromFile;
};

gulp.task('translation-xml-to-json', function(){
  return gulp.src('i18n/translation.xml')
    .pipe(transformer({
      from: 'xml',
      to: 'json'
    }))
    .pipe(gulp.dest('target/'));
});

var makeXmlEntry = function (key, trObj) {
  var xmlEntryString =
    '    <key value="' + key + '">\r\n';
  trObj.val.forEach(function(trObj) {
    xmlEntryString +=
      '        <val lang="' + trObj.lang[0] + '">' + trObj._ + '</val>\r\n'
  });
  xmlEntryString +=
    '    </key>\r\n';
  return xmlEntryString;
};

gulp.task('concat-java', function() {
  return gulp.src(['**/*.java'])
    .pipe(concat('plugin.translation.java'))
    .pipe(gulp.dest('target/'));
});

gulp.task('concat-js', function() {
  return gulp.src(['web/**/*.js'])
    .pipe(concat('plugin.translation.js'))
    .pipe(gulp.dest('target/'));
});

gulp.task('default', ['prepare-package']);