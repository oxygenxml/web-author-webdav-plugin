(function() {
  // There are two types of WEBDav servers:
  //
  // Enforced - it is possible to enforce multiple WEBDav servers:
  //          -- through the "WebDAV Connector" plugin dialog (from the Administration page), 'Enforced server' option
  //          -- by using the 'window.addEnforcedWebdavUrl' API
  // Custom - the user can enter a WEBDav server address in the Dashboard WEBDav tab (only of if there are no multiple enforced servers)

  // -------- Load webdav styles --------
  sync.util.loadCSSFile("../plugin-resources/webdav/webdav.css");

  // -----------------------------------------------------------------------------------------------------

  /**
   * Convert the internal form of the URL (with webdav- prefix) to a user-readable form.
   *
   * @param {string} editUrl The server URL.
   *
   * @return {*|string}
   */
  function getFileServerURLForDisplay(editUrl) {
    // if none was set we let it empty.
    if (editUrl && (editUrl.indexOf('webdav-') === 0)) {
      editUrl = editUrl.substring(7);
    }
    return editUrl;
  }

  /**
   * Converts an URL entered by an user to an "webdav-" URL.
   *
   * @param {string} url The url to process.
   * @param {string=} opt_type The type of the URL: 'FILE' or 'COLLECTION' or 'NON_WEBDAV'.
   *
   * @return {string} the processed url.
   */
  function convertToWebDAVUrl(url, opt_type) {
    var processedUrl = url;
    if (opt_type) {
      var isFile = opt_type === 'FILE';
      // Make sure folder urls end with '/'.
      if (!isFile && url.lastIndexOf('/') !== url.length - 1) {
        processedUrl = url + '/';
      }
    }

    // if the url does not start with 'webdav' prepend it to the url.
    if((processedUrl.indexOf('webdav-') !== 0)) {
      processedUrl = 'webdav-' + processedUrl;
    }
    return processedUrl;
  }

  // --------- Users Store
  UsersManager = {};

  /**
   * @type {string} The key used for localStorage to store the users.
   */
  UsersManager.STORAGE_KEY = 'webdav.users';

  /** The current editor URL (it is used before_editor_loaded event) */
  UsersManager.editorURL = decodeURIComponent(sync.util.getURLParameter('url'));

  /**
   * Saves the current username for a particular server.
   *
   * @param username the username.
   * @param serverURL the server for which to store the username.
   */
  UsersManager.saveUser = function(username, serverURL) {
    serverURL = serverURL || UsersManager.editorURL;
    if(!serverURL) {
      return;
    }
    serverURL = convertToWebDAVUrl(serverURL);

    var serverID = UsersManager.computeServerID_(serverURL);

    var storedUsers = JSON.parse(localStorage.getItem(UsersManager.STORAGE_KEY) || '{}');
    storedUsers[serverID] = username;

    localStorage.setItem(UsersManager.STORAGE_KEY, JSON.stringify(storedUsers));
  };


  /**
   * Saves the current username for a particular server.
   *
   * @param username the username.
   * @param {string} serverURL the server for which to store the username.
   */
  UsersManager.getUser = function(serverURL) {
    serverURL = serverURL || UsersManager.editorURL;
    var userName;

    if(serverURL) {
      serverURL = convertToWebDAVUrl(serverURL);
      var serverID = UsersManager.computeServerID_(serverURL);
      var storedUsers = JSON.parse(localStorage.getItem(UsersManager.STORAGE_KEY) || '{}');

      userName = storedUsers[serverID];
    }
    return userName;
  };

  /**
   * Compute an ID based on the server's URL.
   *
   * @param serverURL the server for which to compute an ID.
   *
   * @return {string} The server's ID.
   */
  UsersManager.computeServerID_ = function(serverURL) {
    var serverID = null;

    if(serverURL) {
      var url = new sync.util.Url(serverURL);
      serverID = url.getScheme() + url.getDomain() + (url.getPort() || '');
    }
    return serverID;
  };

  /**
   * Clears user info.
   */
  UsersManager.clearUsers = function(serverURL) {
    localStorage.removeItem(UsersManager.STORAGE_KEY);
  }


  // -------- Login Manager -----------------------------------------------------

  /**
   * Login manager.
   *
   * @param {string} serverUrl The URL of the server to login to.
   * @param {function(string=)} userChangedCallback The callback to be called when the user is changed.
   * @param {boolean=} opt_forceDialog true if we should display the login dialog instead of the inline form.
   *
   * @constructor
   */
  var LoginManager = function(serverUrl, userChangedCallback, opt_forceDialog) {
    this.serverUrl_ = serverUrl;
    this.loginCallback = null;
    this.userChangedCallback = userChangedCallback;
    this.forceDialog_ = !!opt_forceDialog;
  };


  /**
   * Trigger the login procedure.
   *
   * @param {function()} callback Called when the login is successful.
   */
  LoginManager.prototype.login = function(callback) {
    this.loginCallback = callback;
    var loginFormContainer = document.querySelector('.file-list-login-container');
    if (loginFormContainer && !this.forceDialog_) {
      // On Dashboard if a folder is opened, show an embedded form.
      this.renderInlineLoginForm(loginFormContainer);
    } else {
      var loginDialog = this.createLoginDialog();
      loginDialog.show();
      this.renderLoginForm(loginDialog.getElement(), 'form');
    }
  };

  /**
   * Create a user & password login form in the given element.
   *
   * @param {HTMLElement} element The element where to render the login form.
   * @param {String} formTag The element tag of the form.
   */
  LoginManager.prototype.renderLoginForm = function (element, formTag) {
    var cD = goog.dom.createDom;
    var webdavNameInput = cD('input', {
      id: 'webdav-name',
      type: 'text',
      'class': 'oxy-input',
      'autocorrect': 'off',
      'autocapitalize': 'none',
      'autofocus': '',
      'autocomplete': 'username'
    });

    goog.dom.appendChild(element,
      cD(formTag, 'webdav-login-dialog',
        cD('label', '',
          tr(msgs.NAME_) + ': ',
          webdavNameInput
        ),
        cD('label', '',
          tr(msgs.PASSWORD_) + ': ',
          cD('input', {
            id: 'webdav-passwd',
            type: 'password',
            'class': 'oxy-input',
            autocomplete: 'current-password'
          })
        )
      )
    );

    // Pre-populate the form with the last logged in user.
    try {
      var lastUser = UsersManager.getUser(this.serverUrl_);
    } catch (e) {
      console.warn(e);
    }

    webdavNameInput.value = lastUser || '';
    webdavNameInput.select();
  };

  /**
   * Submit the credentials filled in by the user.
   *
   * @param {HTMLElement} formElement The form.
   */
  LoginManager.prototype.submitCredentials = function(formElement) {
    // Send the user and password to the login servlet which runs in the webapp.
    var userField = formElement.querySelector('#webdav-name');
    var user = userField.value.trim();
    var passwdField = formElement.querySelector('#webdav-passwd');
    var passwd = passwdField.value;
    var serverUrl = this.serverUrl_;

    goog.net.XhrIo.send(
      '../plugins-dispatcher/login',
      goog.bind(function() {
        this.loginCallback();
        this.userChangedCallback(user);
        // Save the user name in local storage
        try {
          UsersManager.saveUser(user, serverUrl);
        } catch (e) {
          console.warn(e);
        }
      }, this),
      'POST',
      // form params
      goog.Uri.QueryData.createFromMap(new goog.structs.Map({
        user: user,
        passwd: passwd,
        server: convertToWebDAVUrl(this.serverUrl_)
      })).toString()
    );
  };

  /**
   * Create the login dialog.
   *
   * @return {sync.api.Dialog}
   */
  LoginManager.prototype.createLoginDialog = function() {
    var loginDialog = workspace.createDialog();
    loginDialog.setTitle(tr(msgs.AUTHENTICATION_REQUIRED_));
    loginDialog.setPreferredSize(300, null);
    loginDialog.onSelect(goog.bind(function(key) {
      if (key === 'ok') {
        this.submitCredentials(loginDialog.getElement());
      }
      loginDialog.dispose();
    }, this));
    return loginDialog;
  };

  /**
   * Render an inline login form in the given element.
   *
   * @param {HTMLElement} container The container of the login form.
   */
  LoginManager.prototype.renderInlineLoginForm = function(container) {
    var formElement = goog.dom.createDom('form', 'webdav-login-form');
    goog.dom.removeChildren(container);
    goog.dom.appendChild(formElement, goog.dom.createDom('div', 'webdav-login-form-title', tr(msgs.AUTHENTICATION_REQUIRED_)));

    goog.dom.appendChild(container, formElement);

    this.renderLoginForm(formElement, 'div');

    var loginButton = goog.dom.createDom('button', ['oxy-button', 'oxy-primary-button'], tr(msgs.LOGIN_));
    goog.dom.appendChild(formElement,
      goog.dom.createDom('div', 'webdav-button-container', loginButton));

    goog.events.listen(loginButton, goog.events.EventType.CLICK, goog.bind(function () {
      this.submitCredentials(formElement);
      goog.dom.removeNode(formElement);
    }, this));
  };

  // -------- Initializing Webdav file server browser ------------
  var webdavFileServer = {};

  /**
   * Login to the server.
   *
   * @param {String} serverUrl The server URL.
   * @param {function} loginCallback The function to call after the user is logged in on the server.
   */
  webdavFileServer.login = function(serverUrl, loginCallback) {
    new LoginManager(serverUrl, this.userChangedCallback).login(loginCallback);
  };

  /**
   * Get the user name.
   */
  webdavFileServer.getUserName = function() {
    try {
      return UsersManager.getUser();
    } catch (e) {
      console.warn(e);
    }
  };

  /**
   * Set the callback method that must be called by the file server when the username is changed.
   */
  webdavFileServer.setUserChangedCallback = function(userChangedCallback) {
    this.userChangedCallback = userChangedCallback;
  };

  /**
   * Logout from server.
   *
   * @param {function} logoutCallback The function to call when the server logout process is completed.
   */
  webdavFileServer.logout = function (logoutCallback) {
    goog.net.XhrIo.send('../plugins-dispatcher/login?action=logout', function() {
        logoutCallback();
        // Clear the user name saved in local storage
        try {
          UsersManager.clearUsers();
        } catch (e) {
          console.warn(e);
        }
      }, 'POST'
    );
  };

  /**
   * Create the component that renders the root URL.
   *
   * @param {string} rootUrl The server root URL to render details for.
   * @param {function} rootURLChangedCallback The function to call when the root URL is changed.
   * @param {boolean} readOnly True if the root URL should not be editable by using this component.
   */
  webdavFileServer.createRootUrlComponent = function (rootUrl, rootURLChangedCallback, readOnly) {
    var comp = new RootUrlComponent(rootUrl, rootURLChangedCallback, readOnly, this.enforcedServers);
    return comp.render();
  };

  /**
   * Request the URL info from the file server server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} urlInfoCallback The function to call when the URL info is available.
   * @param {function} showErrorMessageCallback The function to call when an error message must be presented to the user.
   */
  webdavFileServer.getUrlInfo = function (url, urlInfoCallback, showErrorMessageCallback) {
    var urlInfoProvider = new UrlInfoProvider(null, showErrorMessageCallback);
    urlInfoProvider.requestUrlInfo_(url, urlInfoCallback);
  };

  /**
   * Processes and adds the url to the enforced servers list.
   *
   * @param url The url to enforce.
   *
   * @private
   */
  webdavFileServer.addEnforcedUrl_ = function(url) {
    if(url) {
      this.enforcedServers.push(convertToWebDAVUrl(url));
      if (webdavFileServer.enforcedServersProcessed) {
        processEnforcedServers_();
      }
    }
  };

  // -----------------------------------------------------------------------------------------------------

  /**
   * The root URL editing widget.
   *
   * @param {string} rootUrl The initial value of the root URL.
   * @param {function} rootURLChangedCallback Callback to use when the user chose a different URL.
   * @param {boolean} readOnly true if we should render the widget in read-only mode.
   * @param {Array<String>} enforcedServers The list of enforced servers, or null.
   * @constructor
   */
  var RootUrlComponent = function (rootUrl, rootURLChangedCallback, readOnly, enforcedServers) {
    this.rootUrl_ = rootUrl;
    this.rootChangedCb_ = rootURLChangedCallback;

    this.enforcedServers_ = enforcedServers || [];
    this.canEdit_ = this.enforcedServers_.length !== 1 && !readOnly;

    // Not yet rendered.
    this.serverDiv_ = null;
    this.inplaceNotificator_ = null;
  };


  /**
   * Renders the component in a HTML element and returns it.
   *
   * @return {HTMLElement} The widget.
   */
  RootUrlComponent.prototype.render = function() {
    this.serverDiv_ = goog.dom.createDom('div', 'webdav-repo');
    if (!this.rootUrl_ && this.canEdit_) {
      this.renderRepoEditElement_();
    } else {
      this.renderRepoPreviewElement_();
    }
    return this.serverDiv_;
  };

  /**
   * Hides the in-place error messaage.
   */
  RootUrlComponent.prototype.hideErrorMessage = function() {
    this.inplaceNotificator_.hide();
  };

  /**
   * Shows an in-place error message.
   *
   * @param {string} message The message to show.
   */
  RootUrlComponent.prototype.showErrorMessage = function(message) {
    this.inplaceNotificator_.show(message, sync.view.InplaceNotificationReporter.types.ERROR);
  };

  /**
   * Reset the rendering of the component.
   *
   * @private
   */
  RootUrlComponent.prototype.resetRendering_ = function () {
    if (this.inplaceNotificator_) {
      this.inplaceNotificator_.dispose();
    }
    goog.dom.removeChildren(this.serverDiv_);
    this.inplaceNotificator_ = new sync.view.InplaceNotificationReporter(this.serverDiv_);
  };

  /**
   * Create and add the preview element for file server.
   *
   * @private
   */
  RootUrlComponent.prototype.renderRepoPreviewElement_ = function () {
    var editRepoButton = null;
    if (this.canEdit_) {
      // Add an edit button only of there are no enforced servers or there are more than one enforced server.
      editRepoButton = goog.dom.createDom('button', {className: 'webdav-domain-edit', title: tr(msgs.EDIT_SERVER_URL_)});
      goog.events.listen(editRepoButton, goog.events.EventType.CLICK,
        goog.bind(this.renderRepoEditElement_, this));
    }

    this.resetRendering_();
    goog.dom.append(this.serverDiv_ ,
      goog.dom.createDom('div', {
        className: 'domain-icon',
        style: 'background-image: url(' +  sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor()) + ');vertical-align: middle;'
      }),
      goog.dom.createDom('div', 'webdav-repo-preview', new sync.util.Url(this.rootUrl_).getDomain(),
      editRepoButton));
  };

  /**
   * Commit changes made when user tries to set another server.
   *
   * @private
   */
  RootUrlComponent.prototype.commitEditFileServerChanges_ = function () {
    this.hideErrorMessage();

    var input = document.getElementById('webdav-browse-url');
    var url = input.value.trim();

    if (url) {
      if (url.match('(webdav-)?https?:\/\/')) {
        if (this.enforcedServers_.length > 0) {
          // We can arrive here only if the user selected among a few enforced server URLs.
          try {
            localStorage.setItem('webdav.latestEnforcedURL', url);
          } catch (e) {
            console.warn(e);
          }
          var rootUrl = convertToWebDAVUrl(url);
          this.rootChangedCb_(rootUrl, rootUrl);
        } else {
          var urlInfoProvider = new UrlInfoProvider(goog.bind(this.showSpinner_, this),
            goog.bind(this.showErrorMessage, this));
          urlInfoProvider.requestUrlInfo_(convertToWebDAVUrl(url), this.rootChangedCb_);
        }
      } else {
        var errorMessage = tr(msgs.INVALID_URL_) + ": " + getFileServerURLForDisplay(url);
        this.showErrorMessage(errorMessage);
      }
    } else {
      // The URL is empty.
      this.showErrorMessage(tr(msgs.INVALID_URL_));
    }
  };

  /**
   * Show a spinner while asking for URL details.
   *
   * @param {boolean} show
   *
   * @private
   */
  RootUrlComponent.prototype.showSpinner_ = function(show) {
    var connectBtn = document.querySelector('.webdav-domain-set');
    if (show) {
      connectBtn.disabled = 'true';
      goog.dom.classlist.add(connectBtn, 'oxy-spinner');
    } else {
      connectBtn.removeAttribute('disabled');
      goog.dom.classlist.remove(connectBtn, 'oxy-spinner');
    }
  };

  /**
   * Create and add the element that contains the edit server URL components.
   *
   * @private
   */
  RootUrlComponent.prototype.renderRepoEditElement_ = function () {
    var cD = goog.dom.createDom;
    var okBtn = cD('button', {
      'class': 'oxy-button oxy-small-button oxy-primary-button webdav-domain-set'
    }, tr(msgs.CONNECT_));
    goog.events.listen(okBtn, goog.events.EventType.CLICK,
      goog.bind(this.commitEditFileServerChanges_, this));

    var cancelBtn = null;
    if (this.rootUrl_) {
      // If we have an existing root URL, display a cancel button to fallback to it.
      cancelBtn = cD('button', {className: 'oxy-button oxy-small-button webdav-domain-cancel'}, tr(msgs.CANCEL_));
      goog.events.listen(cancelBtn, goog.events.EventType.CLICK,
        goog.bind(this.renderRepoPreviewElement_, this));
    }

    var serverInput = this.createRootURLEditElement_();
    this.resetRendering_();
    goog.dom.appendChild(this.serverDiv_,
      cD('div', 'webdav-repo-editing',
        cD('div', 'webdav-repo-edit-label', tr(msgs.SERVER_URL_) + ':'),
        serverInput,
        cD('div', 'webdav-button-container',
          okBtn,
          cancelBtn)));
    serverInput.focus();
  };

  /**
   * Get options for enforced servers.
   *
   * @return {Array<Element>} options Array containing all options elements corresponding to enforced servers.
   *
   * @private
   */
  RootUrlComponent.prototype.getEnforcedServersOptions_ = function () {
    var options = [];
    for (var i = 0; i < this.enforcedServers_.length; i++) {
      var serverUrl = this.enforcedServers_[i];
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
    return options;
  };

  /**
   * Create and add the element that contains the edit server input component.
   *
   * @private
   */
  RootUrlComponent.prototype.createRootURLEditElement_ = function() {
    var cD = goog.dom.createDom;
    var serverEditElement = null;

    var enforcedServersOptions = this.getEnforcedServersOptions_();
    if(enforcedServersOptions.length !== 0) {
      // Multiple enforced servers, we will present them in a select component
      serverEditElement = cD('select', {id: 'webdav-browse-url'}, enforcedServersOptions);
    } else {
      serverEditElement = cD('input', {
        id: 'webdav-browse-url',
        type: 'text',
        'class': 'oxy-input',
        autocorrect: 'off',
        autocapitalize: 'none',
        autofocus: true,
        value: getFileServerURLForDisplay(this.rootUrl_) || ''
      });

      if (this.rootUrl_) {
        // If we already had a root URL, on Esc go back to the previous state.
        goog.events.listen(serverEditElement, goog.events.EventType.KEYUP, goog.bind(function(e) {
          if (e.keyCode === goog.events.KeyCodes.ESC) {
            e.stopPropagation();
            this.renderRepoPreviewElement_();
          }
        }, this));
      }
    }
    return serverEditElement;
  };

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Class used to obtain information about an URL.
   *
   * @param {function(boolean)} reqStatusListener Called with true when the server request started and with false when
   * it ends.
   * @param {function(string)} showError Called to display an error.
   *
   * @constructor
   */
  var UrlInfoProvider = function(reqStatusListener, showError) {
    this.showError_ = showError || goog.bind(console.log, console);
    this.reqStatusListener_ = reqStatusListener || goog.nullFunction;
  };

  /**
   * Request the URL info from the server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} callback The callback function.
   */
  UrlInfoProvider.prototype.requestUrlInfo_ = function (url, callback) {
    this.reqStatusListener_(true);
    goog.net.XhrIo.send(
      '../plugins-dispatcher/webdav-url-info?url=' + encodeURIComponent(url),
      goog.bind(this.handleUrlInfoReceived_, this, url, callback));
  };

  /**
   * URL information received from the server, we can open that URL in the dialog.
   *
   * @param {string} url The URL about which we requested info.
   * @param {function} callback the callback method.
   * @param {goog.events.Event} e The XHR event.
   */
  UrlInfoProvider.prototype.handleUrlInfoReceived_ = function (url, callback, e) {
    this.reqStatusListener_(false);
    var request = /** {@type goog.net.XhrIo} */ (e.target);
    var status = request.getStatus();

    if (status === 200) {
      var info = request.getResponseJson();
      var currentUrl = convertToWebDAVUrl(url, info.type);
      var rootUrl = convertToWebDAVUrl(info.rootUrl, 'COLLECTION');
      callback(rootUrl, currentUrl);
    } else if (status === 401) {
      new LoginManager(url, webdavFileServer.userChangedCallback, true)
        .login(goog.bind(this.requestUrlInfo_, this, url, callback));
    } else {
      var errorMessage = tr(msgs.INVALID_URL_) + ": " + getFileServerURLForDisplay(url);
      this.showError_(errorMessage);
    }
  };

  // -------- Initialize the file browser information ------------
  webdavFileServer.enforcedServers = [];
  var enforcedServer = sync.options.PluginsOptions.getClientOption('enforced_webdav_server');
  if(enforcedServer) {
    webdavFileServer.addEnforcedUrl_(enforcedServer);
  }
  // Declare a global method to register an enforced URL
  window.addEnforcedWebdavUrl = goog.bind(webdavFileServer.addEnforcedUrl_, webdavFileServer);

  var webdavFileServerDescriptor = {
    'id' : 'webdav',
    'name' : 'WebDAV',
    'icon' : sync.util.computeHdpiIcon('../plugin-resources/webdav/Webdav70.png'), // the large icon url, hidpi enabled.
    'matches' : function matches(url) {
      return url.match(/^webdav-https?:/); // Check if the provided URL points to a file or folder from WebDAV file server
    },
    'fileServer' : webdavFileServer
  };

  // -------- Register the Webdav files server ------------
  workspace.getFileServersManager().registerFileServerConnector(webdavFileServerDescriptor);

  function processEnforcedServers_(){
    // Check if there is an enforced server that must be imposed
    var enforcedServers = webdavFileServer.enforcedServers;
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
    webdavFileServer.enforcedServersProcessed = true;
  }

  setTimeout(processEnforcedServers_, 0);
})();
