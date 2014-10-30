package com.oxygenxml.examples.webdav;


import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

/**
 * Class responsible with determining the context of an URL connection, i.e.
 * which is the user on behalf of which we are making the request.
 */
public class WebdavManagerFilter {
  /**
   * Cache of user credentials.
   */
  private static Cache<String, UserCredentials> userDataCache = 
      CacheBuilder.newBuilder().build();
  
  /**
   * Returns the user data for the given user Id. It does not check it against
   * the current user.
   * 
   * @param userId The id of the user.
   * 
   * @return The user data.
   */
  public static UserCredentials getUserData(String userId) {
    try {
      return userDataCache.get(userId, new Callable<UserCredentials>() {
        @Override
        public UserCredentials call() throws Exception {
          return new UserCredentials();
        }
      });
    } catch (ExecutionException e) {
      // Cannot happen.
      return null;
    }
  }
}
