package com.oxygenxml.examples.webdav;

import java.io.OutputStream;
import java.net.PasswordAuthentication;
import java.net.URL;

import org.apache.commons.io.IOUtils;
import org.junit.Test;

public class WebdavUrlConnectionTest {

  @Test
  public void testCommit() throws Exception {
    WebdavUrlStreamHandler.credentials.put("3", new PasswordAuthentication("ctalau", "oxygen".toCharArray()));

    URL fileUrl = new URL("http://localhost/svn/project1/ceva.xml");
    WebdavUrlConnection webdavConn = new WebdavUrlConnection("3", fileUrl.openConnection());

    OutputStream outputStream = webdavConn.getOutputStreamToSVNServer();
    try {
      IOUtils.write("<root/>", outputStream);
    } finally {
      outputStream.close();
    }
  }
}
