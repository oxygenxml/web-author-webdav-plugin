(function() {
  // There are two types of WEBDav servers:
  //
  // Enforced - it is possible to enforce multiple WEBDav servers:
  //          -- through the "WebDAV Connector" plugin dialog (from the Administration page), 'Enforced server' option
  //          -- by using the 'window.addEnforcedWebdavUrl' API
  // Custom - the user can enter a WEBDav server address in the Dashboard WEBDav tab (only of if there are no multiple enforced servers)

  // -------- Load webdav styles --------
  sync.util.loadCSSFile("../plugin-resources/webdav/webdav.css");

  // -------- Initializing Webdav file repository browser ------------
  var webdavFileRepositoryBrowser = {};

  /**
   * Login to the server.
   *
   * @param {String} serverUrl The server URL.
   * @param {function} loginCallback The function to call after the user is logged in on the server.
   */
  webdavFileRepositoryBrowser.login = function(serverUrl, loginCallback) {
    serverUrl = webdavFileRepositoryBrowser.processURL_(serverUrl);

    var webdavNameInput,
      webdavPasswordInput;
    // pop-up an authentication window,
    if (!this.loginDialog_) {
      this.loginDialog_ = workspace.createDialog();

      var cD = goog.dom.createDom;

      webdavNameInput = cD('input', {id: 'webdav-name', type: 'text'});
      webdavNameInput.setAttribute('autocorrect', 'off');
      webdavNameInput.setAttribute('autocapitalize', 'none');
      webdavNameInput.setAttribute('autofocus', '');

      webdavPasswordInput = cD('input', {id: 'webdav-passwd', type: 'password'});

      goog.dom.appendChild(this.loginDialog_.getElement(),
        cD('div', 'webdav-login-dialog',
          cD('label', '',
            tr(msgs.NAME_) + ': ',
            webdavNameInput
          ),
          cD('label', '',
            tr(msgs.PASSWORD_)+ ': ',
            webdavPasswordInput
          )
        )
      );

      this.loginDialog_.setTitle(tr(msgs.AUTHENTICATION_REQUIRED_FOR_, {'$PROD': 'WebDAV'}));
      this.loginDialog_.setPreferredSize(300, null);
    }

    this.loginDialog_.onSelect(function(key) {
      if (key === 'ok') {
        // Send the user and password to the login servlet which runs in the webapp.
        var userField = webdavNameInput || document.getElementById('webdav-name');
        var user = userField.value.trim();
        var passwdField = webdavPasswordInput || document.getElementById('webdav-passwd');
        var passwd = passwdField.value;

        userField.value = '';
        passwdField.value = '';

        goog.net.XhrIo.send(
          '../plugins-dispatcher/login',
          function () {
            try {
              localStorage.setItem('webdav.user', user);
            } catch (e) {
              console.warn(e);
            }

            webdavFileRepositoryBrowser.username = user;
            loginCallback();
          },
          'POST',
          // form params
          goog.Uri.QueryData.createFromMap(new goog.structs.Map({
            user: user,
            passwd: passwd,
            server: serverUrl
          })).toString()
        );
      }
    });

    this.loginDialog_.show();
    try {
      var lastUser = localStorage.getItem('webdav.user');
    } catch (e) {
      console.warn(e);
    }
    if(lastUser) {
      var userInput = webdavNameInput || this.loginDialog_.getElement().querySelector('#webdav-name');
      userInput.value = lastUser;
      userInput.select();
    }
  };

  /**
   * Logout from repository.
   *
   * @param {function} logoutCallback The function to call when the repository logout process is completed.
   */
  webdavFileRepositoryBrowser.logout = function (logoutCallback) {
    goog.net.XhrIo.send(
      '../plugins-dispatcher/login?action=logout',
      goog.bind(function () {
        try {
          localStorage.removeItem('webdav.user');
        } catch (e) {
          console.warn(e);
        }

        logoutCallback();
      }, this),
      'POST');
  };

  /**
   * This method can be used to render particular repository root URL information (can be used for example to display some
   * branches information or to render some repository specific images) on the top part of the repository component.
   *
   * @param {string} rootUrl The repository root URL to render details for.
   * @param {string} currentBrowseUrl The current repository browse URL.
   * @param {function} rootURLChangedCallback The function to call when the root URL is changed.
   */
  webdavFileRepositoryBrowser.createRepositoryAddressComponent = function (rootUrl, currentBrowseUrl, rootURLChangedCallback) {
    var canEdit = this.enforcedServers.length !== 1;
    var repositoryDiv = goog.dom.createDom('div', 'webdav-repo',
      goog.dom.createDom('div', {
        className: 'domain-icon',
        style: 'background-image: url(' +  sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor()) + ');vertical-align: middle;'
      })
    );

    var showErrorMessageCallback = function(message) {
      if (!repositoryDiv.inplaceNotificator_) {
        repositoryDiv.inplaceNotificator_ = new sync.view.InplaceNotificationReporter(repositoryDiv);
      }
      if (message) {
        repositoryDiv.inplaceNotificator_.show(message, sync.view.InplaceNotificationReporter.types.ERROR);
      } else {
        repositoryDiv.inplaceNotificator_.hide();
      }
    };

    if (!rootUrl && canEdit) {
      this.createRepoEditElement_(rootUrl, currentBrowseUrl, repositoryDiv, canEdit, rootURLChangedCallback, showErrorMessageCallback);
    } else {
      this.createRepoPreviewElement_(rootUrl, currentBrowseUrl, repositoryDiv, canEdit, rootURLChangedCallback, showErrorMessageCallback);
    }

    return repositoryDiv;
  };

  /**
   * Request the URL info from the file repository server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} urlInfoCallback The function to call when the URL info is available.
   * @param {function} showErrorMessageCallback The function to call when an error message must be presented to the user.
   */
  webdavFileRepositoryBrowser.getUrlInfo = function (url, urlInfoCallback, showErrorMessageCallback) {
    this.requestUrlInfo_(url, goog.bind(function (url, info) {
      this.sendRepositoryUrlChangedInfo_(url, info, urlInfoCallback);
    }, this), showErrorMessageCallback);
  };

  /**
   * Processes and adds the url to the enforced servers list.
   *
   * @param url The url to enforce.
   *
   * @private
   */
  webdavFileRepositoryBrowser.addEnforcedUrl_ = function(url) {
    if(url) {
      this.enforcedServers.push(this.processURL_(url));
      if (webdavFileRepositoryBrowser.enforcedServersProcessed) {
        processEnforcedServers_();
      }
    }
  };

  /**
   * Create and add the preview element for file repository.
   *
   * @param {string} rootUrl The repository root URL to render details for.
   * @param {string} currentBrowseUrl The current repository browse URL.
   * @param {Element} repositoryDiv The element that contains the repository preview element.
   * @param {boolean} canEdit Flag indicating if the repository URL can be changed.
   * @param {function} rootURLChangedCallback Callback to be called when changing the root URL.
   * @param {function} showErrorMessageCallback Callback to be called when an error message must be presented to the user.
   *
   * @private
   */
  webdavFileRepositoryBrowser.createRepoPreviewElement_ = function (rootUrl, currentBrowseUrl, repositoryDiv, canEdit, rootURLChangedCallback, showErrorMessageCallback) {
    var editRepoButton = null;
    if (canEdit) {
      // Add an edit button only of there are no enforced servers or there are more than one enforced server.
      editRepoButton = goog.dom.createDom('div', {className: 'webdav-domain-edit', title: tr(msgs.EDIT_SERVER_URL_)});

      goog.events.listen(editRepoButton, goog.events.EventType.CLICK,
        goog.bind(function() {
          // Hide errors
          showErrorMessageCallback(null);
          // Remove render element and display edit elemenet
          var repoPreviewDiv = repositoryDiv.querySelector('.webdav-repo-preview');
          goog.dom.removeNode(repoPreviewDiv);
          this.createRepoEditElement_(rootUrl, currentBrowseUrl, repositoryDiv, canEdit, rootURLChangedCallback, showErrorMessageCallback);
        }, this));
    }
    goog.dom.appendChild(repositoryDiv ,goog.dom.createDom('div', 'webdav-repo-preview', new sync.util.Url(rootUrl).getDomain(), editRepoButton));
  };

  /**
   * Commit changes made when user tries to set another repository.
   *
   * @param {function} rootURLChangedCallback Callback to be called when changing the root URL.
   * @param {function} showErrorMessageCallback Callback to be called when an error message must be presented to the user.
   *
   * @private
   */
  webdavFileRepositoryBrowser.commitEditRepositoryChanges_ = function (rootURLChangedCallback, showErrorMessageCallback) {
    showErrorMessageCallback(null);

    var input = document.getElementById('webdav-browse-url');
    var url = input.value.trim();

    if (url) {
      if (url.match('(webdav-)?https?:\/\/')) {
        if (this.enforcedServers.length > 0) {
          this.enforcedUrl = url;
          try {
            localStorage.setItem('webdav.latestEnforcedURL', this.enforcedUrl);
          } catch (e) {
            console.warn(e);
          }

          this.sendRepositoryUrlChangedInfo_(url, {rootUrl: url}, rootURLChangedCallback);
        } else {
          this.getUrlInfo(this.processURL_(url), rootURLChangedCallback, showErrorMessageCallback);
        }
      } else {
        var errorMessage = tr(msgs.INVALID_URL_) + ": " + url;
        if (showErrorMessageCallback) {
          showErrorMessageCallback(errorMessage);
        } else {
          console.log(errorMessage);
        }
      }
    }
  };

  /**
   * Create and add the element that contains the edit repository URL components.
   *
   * @param {string} rootUrl The repository root URL to render details for.
   * @param {string} currentBrowseUrl The current browse URL.
   * @param {Element} repositoryDiv The element that renders the repository edit components.
   * @param {boolean} canEdit Flag indicating if the repository URL can be changed.
   * @param {function} rootURLChangedCallback Callback to be called when changing the root URL.
   * @param {function} showErrorMessageCallback Callback to be called when an error message must be presented to the user.
   *
   * @private
   */
  webdavFileRepositoryBrowser.createRepoEditElement_ = function (rootUrl, currentBrowseUrl, repositoryDiv, canEdit, rootURLChangedCallback, showErrorMessageCallback) {
    if (canEdit) {
      var okBtn = this.enforcedServers.length > 1 ? null : goog.dom.createDom('div',  {className: 'webdav-domain-set', title: tr(msgs.SET_SERVER_URL_)});
      if (okBtn) {
        goog.events.listen(okBtn, goog.events.EventType.CLICK, goog.bind(this.commitEditRepositoryChanges_, this, rootURLChangedCallback, showErrorMessageCallback));
      }
      goog.dom.appendChild(repositoryDiv,
        goog.dom.createDom('div', 'webdav-repo-editing', this.createRootURLEditElement_(rootUrl, currentBrowseUrl, repositoryDiv, rootURLChangedCallback, showErrorMessageCallback), okBtn));
    }
  };

  /**
   * Determine the root url and browse url and send them as parameters in the provided callback.
   *
   * @param {string} url The repository browse URL.
   * @param {Object} info The repository URL info (contains the root URL).
   * @param {function} repositoryUrlChangedCallback Callback to be called when changing the root URL.
   *
   * @private
   */
  webdavFileRepositoryBrowser.sendRepositoryUrlChangedInfo_ = function(url, info, repositoryUrlChangedCallback) {
    var isFile = info.type === 'FILE';
    // Make sure folder urls end with '/'.
    if (!isFile && url.lastIndexOf('/') !== url.length - 1) {
      url = url + '/';
    }

    var rootUrl = this.processURL_(info.rootUrl);
    // Root URL is changed
    repositoryUrlChangedCallback(rootUrl, url);
  };

  /**
   * Get options for enforced servers.
   *
   * @return {Array<Element>} options Array containing all options elements corresponding to enforced servers.
   *
   * @private
   */
  webdavFileRepositoryBrowser.getEnforcedServersOptions_ = function () {
    var options = null;
    if (this.enforcedServers) {
      var enforcedServersLength = this.enforcedServers.length;
      if (enforcedServersLength > 0) {
        options = [];
        for (var i = 0; i < enforcedServersLength; i++) {
          var serverUrl = this.enforcedServers[i];
          if (serverUrl) {
            var option = goog.dom.createDom('option', {value: serverUrl}, serverUrl);
            try {
              if (serverUrl === localStorage.getItem('webdav.latestEnforcedURL')) {
                option.setAttribute('selected', '');
              }
            } catch (e) {
              console.warn(e);
            }
            options.push(option);
          }
        }
      }
    }
    return options;
  };

  /**
   * Get the current browsing URL of the repository, without the webdav particular prefix.
   *
   * @param {string} rootUrl The repository root URL to render details for.
   * @param {string} currentBrowseUrl The current browse URL.
   *
   * @return {*|string}
   */
  function getRepositoryURLForEdit(rootUrl, currentBrowseUrl) {
    // if none was set we let it empty.
    var editUrl = currentBrowseUrl || rootUrl || '';
    if (editUrl && (editUrl.indexOf('webdav-') === 0)) {
      editUrl = editUrl.substring(7);
    }
    return editUrl;
  }

  /**
   * Create and add the element that contains the edit repository input component.
   *
   * @param {string} rootUrl The repository root URL to render details for.
   * @param {string} currentBrowseUrl The current browse URL.
   * @param {Element} repositoryDiv The element that renders the repository edit components.
   * @param {function} rootURLChangedCallback Callback to be called when changing the root URL.
   * @param {function} showErrorMessageCallback Callback to be called when an error message must be presented to the user.
   *
   * @private
   */
  webdavFileRepositoryBrowser.createRootURLEditElement_ = function(rootUrl, currentBrowseUrl, repositoryDiv, rootURLChangedCallback, showErrorMessageCallback) {
    var cD = goog.dom.createDom;
    var repoEditElement = null;

    var enforcedServersOptions = this.getEnforcedServersOptions_();
    if(enforcedServersOptions) {
      // Multiple enforced servers, we will present them in a select component
      repoEditElement = cD('select', {id: 'webdav-browse-url'}, enforcedServersOptions);

      goog.events.listen(repoEditElement, goog.events.EventType.CHANGE, goog.bind(function(e) {
        e.stopPropagation();
        // Commit changes
        this.commitEditRepositoryChanges_(rootURLChangedCallback, showErrorMessageCallback);
      }, this));

      goog.events.listen(repoEditElement, goog.events.EventType.FOCUS, function() {
        // On focus unselect the currently selected index because onChange event is fired only when the selection changes
        // (if the same repository root URL is choosen we want to trigger the authentication or to request the files again
        // from the server)
        this.selectedIndex = -1;
      });

    } else {
      repoEditElement = cD('input', {
          id: 'webdav-browse-url',
          type: 'text',
          autocorrect: 'off',
          autocapitalize: 'none',
          autofocus: '',
          value: getRepositoryURLForEdit(rootUrl, currentBrowseUrl)
        });

      goog.events.listen(repoEditElement, goog.events.EventType.KEYUP, goog.bind(function(e) {
        if (e.keyCode === goog.events.KeyCodes.ENTER) {
          e.stopPropagation();
          // Commit changes
          this.commitEditRepositoryChanges_(rootURLChangedCallback, showErrorMessageCallback);
        }
      }, this));

      goog.events.listen(repoEditElement, goog.events.EventType.KEYUP, goog.bind(function(e) {
        if (e.keyCode === goog.events.KeyCodes.ESC) {
          if (rootUrl) {
            e.stopPropagation();
            // Hide errors
            showErrorMessageCallback(null);
            // Remove render element and display edit elemenet
            var repoEditDiv = repositoryDiv.querySelector('.webdav-repo-editing');
            goog.dom.removeNode(repoEditDiv);
            this.createRepoPreviewElement_(rootUrl, currentBrowseUrl, repositoryDiv, true, rootURLChangedCallback, showErrorMessageCallback);
          }
        }
      }, this));
    }
    return repoEditElement;
  };

  /**
   * Further processes the url.
   *
   * @param {string} url The url to process.
   *
   * @return {string} the processed url.
   */
  webdavFileRepositoryBrowser.processURL_ = function(url) {
    var processedUrl = url;

    // if the url does not start with 'webdav' prepend it to the url.
    if((url.indexOf('webdav-') !== 0)) {
      processedUrl = 'webdav-' + processedUrl;
    }
    return processedUrl;
  };

  /**
   * Request the URL info from the server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} callback The callback function.
   * @param {function} showErrorMessageCallback The function to call when an error message must be presented to the user.
   */
  webdavFileRepositoryBrowser.requestUrlInfo_ = function (url, callback, showErrorMessageCallback) {
    goog.net.XhrIo.send(
      '../plugins-dispatcher/webdav-url-info?url=' + encodeURIComponent(url),
      goog.bind(this.handleUrlInfoReceived_, this, url, callback, showErrorMessageCallback));
  };

  /**
   * URL information received from the server, we can open that URL in the dialog.
   *
   * @param {string} url The URL about which we requested info.
   * @param {function} callback the callback method.
   * @param {function} showErrorMessageCallback The function to call when an error message must be presented to the user.
   * @param {goog.events.Event} e The XHR event.
   */
  webdavFileRepositoryBrowser.handleUrlInfoReceived_ = function (url, callback, showErrorMessageCallback, e) {
    var request = /** {@type goog.net.XhrIo} */ (e.target);
    var status = request.getStatus();

    if (status === 200) {
      var info = request.getResponseJson();
      callback(url, info);
    } else if (status === 401) {
      this.login(url, goog.bind(this.requestUrlInfo_, this, url, callback, showErrorMessageCallback));
    } else {
      var errorMessage = tr(msgs.INVALID_URL_) + ": " + url;
      if (showErrorMessageCallback) {
        showErrorMessageCallback(errorMessage);
      } else {
        console.log(errorMessage);
      }
    }
  };

  // -------- Initialize the file browser information ------------
  webdavFileRepositoryBrowser.enforcedServers = [];
  var enforcedServer = sync.options.PluginsOptions.getClientOption('enforced_webdav_server');
  if(enforcedServer) {
    webdavFileRepositoryBrowser.addEnforcedUrl_(enforcedServer);
  }
  // Declare a global method to register an enforced URL
  window.addEnforcedWebdavUrl = goog.bind(webdavFileRepositoryBrowser.addEnforcedUrl_, webdavFileRepositoryBrowser);

  var webdavFileRepository = {
    'id' : 'webdav',
    'name' : 'WebDAV',
    'icon' : sync.util.computeHdpiIcon('../plugin-resources/webdav/Webdav70.png'), // the large icon url, hidpi enabled.
    'matches' : function matches(url) {
      return url.match(/^webdav-https?:/); // Check if the provided URL points to a file or folder from WebDAV file repository
    },
    'browser' : webdavFileRepositoryBrowser
  };

  // -------- Register the Webdav files repository ------------
  workspace.getFileRepositoriesManager().registerRepository(webdavFileRepository);

  function processEnforcedServers_(){
    // Check if there is an enforced server that must be imposed
    var enforcedServers = webdavFileRepositoryBrowser.enforcedServers;
    if(enforcedServers && enforcedServers.length > 0) {
      var enforcedUrl = null;
      try {
        var initialUrl = localStorage.getItem("webdav.latestUrl");
      } catch (e) {
        console.warn(e);
      }

      var i;

      // try to determine the initial enforced url.
      for(i = 0; i < enforcedServers.length; i++) {
        if (initialUrl && initialUrl.indexOf(enforcedServers[i]) === 0) {
          enforcedUrl = enforcedServers[i];
          break;
        }
      }
      // no default was determined and we have only one enforcedUrl
      if(!enforcedUrl && enforcedServers.length === 1) {
        enforcedUrl = enforcedServers[0];
        initialUrl = enforcedUrl;
      }

      // enforce detected URL.
      if(enforcedUrl) {
        try {
          localStorage.setItem("webdav.latestRootUrl", enforcedUrl);
          localStorage.setItem("webdav.latestUrl", initialUrl);
        } catch (e) {
          console.warn(e);
        }
      }
    }
    webdavFileRepositoryBrowser.enforcedServersProcessed = true;
  }

  setTimeout(processEnforcedServers_, 0);
})();
