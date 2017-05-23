(() => {
  'use strict';

  const _ = require("underscore");
  const redis = require("redis");
    
  const ShadyMessages = class {
    
    constructor() {
      this._listeners = {};
      this._publisher = redis.createClient();
      this._subscriber = redis.createClient();
      this._subscriber.on("message", this._onMessage.bind(this));
    }
    
    on (event, func) {
      if (!this._listeners[event]) {
        this._subscriber.subscribe(event);
        this._listeners[event] = [func];
      } else {
        this._listeners[event].push(func);
      }
    }
    
    trigger (event, data) {
      this._publisher.publish(event, JSON.stringify(data||{}));
    }
    
    _onMessage (channel, message) {
      var data = JSON.parse(message);
      var event = { name: channel };
    
      _.each(this._listeners[channel]||[], function (listener) {
        listener(event, data);
      });
    }
  
  };
  
  module.exports = function setup(options, imports, register) {
    const instance = new ShadyMessages();
    
    register(null, {
      "shady-messages": instance
    });
  };

})();