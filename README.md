Webdav support for the oXygen XML Author WebApp
===============================================

This project is a very simple integration with a WebDAV-enabled server, which can be extended with more features or can be adapted to work with any CMS.

In order to follow the explanations below you can take a look at the `basic` branch of the project which is the easiest to understand, but which misses several features.

Authentication Flow
-------------------

To acces a file that is hosted on a WebDAV server besides the file URL the server also requires the user credential. The oXygen XML Author WebApp requires the user to provide these credentials in order to forward them to the WebDAV server. In this plugin the credential have to be entered on a separate page the first time you open a file on that server.

The authentication flow consists of 4 URLs:
 - The **browsing page**: [browse.html](https://github.com/oxygenxml/webapp-webdav-integration/blob/basic/src/main/webapp/webdav/browse.html) which prompts the users for the Webdav URL to be opened.
 - The **authentication page**: [auth.html](https://github.com/oxygenxml/webapp-webdav-integration/blob/basic/src/main/webapp/webdav/auth.html) which promts the users for the credentials for a given URL and sends them to the server.
 - The **webapp page**, in which the user is able to edit the XML document.
 - The **dispatcher page** which is not an HTML page, but an URL handled by the [com.oxygenxml.examples.webdav.EntryPoint](https://github.com/oxygenxml/webapp-webdav-integration/blob/basic/src/main/java/com/oxygenxml/examples/webdav/EntryPoint.java) servlet and which is responsible with redirecting the user either to the **authentication page**, or to the webapp page if the credentials have been already provided previously. It is also responsible with recording the user credentials provided in the **authentication page**.

The sequence of URLs accessed by a user is the following:

  - first time: browse page -> dispatching page -> authentication page -> dispatching page -> webapp
  - next times: browse page -> dispatching page -> webapp

User Management
---------------

The oXygen XML Author WebApp is left with the task of linking URLs to user credentials which are entered separately. The servlet container (e.g. Tomcat) uses a cookie to track the user session. We associate the credentials that the user provided with that session and we also include the id of that session in the URL that we pass to the WebApp. 

So, the URL that is pass to the WebApp is obtained from the file URL on the WebDAV server by transformig it like this:

`http://example.com/path/to/file.xml`

transforms to 

`webdav-http://USER_ID@example.com/path/to/file.xml`

Note that we also changed the URL scheme to a custom one.


The Custom Protocol Plugin
--------------------------

In order to read and write files identified by `webdav-http` URLs, oXygen XML Author WebApp needs a `URLStreamHandlerPluginExtension` which returns an  [WebdavUrlStreamHandler](https://github.com/oxygenxml/webapp-webdav-integration/blob/basic/src/main/java/com/oxygenxml/examples/webdav/WebdavUrlStreamHandler.java). This plugin extension, strips the user id from the URL, identifies the corresponding username and password and composes a link of the form: 

`http://user:passwd@example.com/path/to/file.xml`

which is handled by the builtin protocol handler to connect to the WebDAV server.

Note that we did not use this kind of URL from the beginning since it appears in the user browser's address bar, which is not desirable from a security point of view.

Bonus points
------------

### Extra security

The solution presented above has the drawback that the URL is linked with the user currently accessing the document. So, if shared and if another person opens the document using the link and saves it, the WebDAV server will record the first user as the author of the edit. Moreover, the second person might not even have access to edit that document.

The solution is to check that the user which is making the request to the WebApp is the same as the user whose id is inside the URL. To this end we store the user id in a ThreadLocal variable before the request execution starts and clear it afterwards. This way, if a link is shared with other people they will be forced to provide *their* credentials before accessing the resource.

You can find the required changes in the `upgraded_security` branch of the project. The changes can be reviewed [here](https://github.com/oxygenxml/webapp-webdav-integration/compare/basic...upgraded_security).

In order to be able to set and reset the ThreadLocal variable before and after every request, the plugin has to register a Filter - [WebdavManagerFilter](https://github.com/oxygenxml/webapp-webdav-integration/blob/upgraded_security/src/main/java/com/oxygenxml/examples/webdav/WebdavManagerFilter.java). 


###Failed Login

One point missed in the above discussion is that the user may mistype the username or the password. In this case, we should redirect the user to the authentication page again in order to provide the correct ones.

The proposed solution achieves this by catching errors thrown by the `URLConnection` to the WebDav server and reseting the credentials that the user entered for that URL. You can find the implementation in the `full` branch of the project. The changes can be reviewed [here](https://github.com/oxygenxml/webapp-webdav-integration/compare/upgraded_security...full).

