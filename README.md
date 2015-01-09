WebDAV Support for oXygen XML Author WebApp
===============================================

This project is a very simple integration of oXygen XML Author WebApp with a WebDAV-enabled server, which can be extended with more features or can be adapted to work with any CMS.

Identifying the requesting user
----------------------

In order to implement a CMS connector, in oXygen one needs to implement a `URLStreamHandlerPluginExtension`,
that returns an `URLStreamHandler` for the protocol used to communicate with the CMS.

In order to support authentication in the multi-user context of the oXygen Webapp, the `URLStreamHandler` instance should 
extend `URLStreamHandlerWithContext`. The difference from `URLStreamHandler` is that the `openConnectionInContext` method receives the session ID that uniquely identifies the user on behalf of which we are accessing the given URL. 

Credentials management
--------------------

When the user logs in, one needs to associate some credentials with the context ID. The simplest implementation would be to create a login servlet and map it in the webapp's `web.xml`. The servlet would associate the user/passwd or the CMS session id with the context ID in a static Map.

Auth failure
-------------

If the `URLStreamHandler` fails to authenticate with the CMS, it should throw an UserActionRequiredException. This exception will carry a WebappMessage that will be sent to the client-side JavaScript code. 

The entire authentication failure handling should be implemented on the client-side. The basic steps are:
- listen for authentication failure messages
- pop-up an auth window
- send the updated credentials to the login servlet
- retry the user action

The implementation can be found in the `plugin.js` file which should be present in the `app/` folder of the webapp `.war`.

Using the plugin
================

In order to use the plugin, starting from the Webapp SDK project, one needs to:
- build the artifact from the current project: `mvn install`
- add a dependency in the bundle-plugins pom.xml file to this artifact (use the latest version):
```
		<dependency>
			<groupId>com.oxygenxml.samples</groupId>
      <artifactId>webapp-webdav-integration</artifactId>
			<version>1.0.0</version>
			<type>jar</type>
			<classifier>plugin</classifier>
		</dependency>
```
- add the LoginServlet to the web.xml file
```
  <servlet>
    <servlet-name>WebDAV login servlet</servlet-name>
    <servlet-class>com.oxygenxml.examples.webdav.LoginServlet</servlet-class>
  </servlet>
  <servlet-mapping>
    <servlet-name>WebDAV login servlet</servlet-name>
    <url-pattern>/login</url-pattern>
  </servlet-mapping>
```
- copy the plugin.js in the `src/main/webapp/app/` folder.

The URL that needs to be passed to the webapp is the WebDAV URL, prefixed with `webdav-` (e.g. `webdav-https://webdav-server.com/file.xml`).

