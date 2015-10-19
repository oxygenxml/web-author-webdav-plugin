WebDAV Support for oXygen XML WebApp
===============================================

This project is a very simple integration of oXygen XML WebApp with a WebDAV-enabled server, which can be extended with more features or can be adapted to work with any CMS.

Identifying the requesting user
----------------------

In order to implement a CMS connector, in oXygen one needs to implement a `URLStreamHandlerPluginExtension`, that returns an `URLStreamHandler` for the protocol used to communicate with the CMS.

In order to support authentication in the multi-user context of the oXygen Webapp, the `URLStreamHandler` instance should 
extend `URLStreamHandlerWithContext`. The difference from `URLStreamHandler` is that the `openConnectionInContext` method receives the session ID that uniquely identifies the user on behalf of which we are accessing the given URL. 

Credentials management
--------------------

When the user logs in, one needs to associate some credentials with the context ID.
 The simplest implementation would be to create a login servlet which implements the WebappServletPluginExtension interface and declare it as a WebappServlet extension in the plugin.xml file. The servlet would associate the user/passwd or the CMS session id with the context ID in a static Map.

Auth failure
-------------

If the `URLStreamHandler` fails to authenticate with the CMS, it should throw an UserActionRequiredException. This exception will carry a WebappMessage that will be sent to the client-side JavaScript code. 

The entire authentication failure handling should be implemented on the client-side. The basic steps are:
- listen for authentication failure messages
- pop-up an auth window
- send the updated credentials to the login servlet
- retry the user action

The implementation can be found in the `plugin.js` file from the `app/` folder in the webapp `.war`.

The URL that needs to be passed to the webapp is the WebDAV URL, prefixed with `webdav-` (e.g. `webdav-https://webdav-server.com/file.xml`).