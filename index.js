(() => {
  'use strict';

  const _ = require("lodash");
  const util = require('util');
  const amqp = require('amqplib/callback_api');
  
  const ShadyMessages = class {
    
    constructor(logger, channel) {
      this._logger = logger;
      this._channel = channel;
      this._exchange = 'shady-messages';
      this._listeners = {};
    }
    
    on (channelName, func) {
      if (!this._listeners[channelName]) {
        this._assertExchange();
        this._channel.assertQueue('', { exclusive: true }, (err, ok) => {
          if (err) {
            this._logger.error(util.format('Error occurred while asserting queue: %s', err));
          } else {
            const queue = ok.queue;
            
            this._channel.bindQueue(queue, this._exchange, channelName);
            this._listeners[channelName] = [func];
            
            this._channel.consume(queue, (message) => {
              this._handleMessage(channelName, message.content.toString());
            }, {noAck: true});
          }
        });
      } else {
        this._listeners[channelName].push(func);
      }
    }
    
    trigger (channelName, data) {
      this._assertExchange();
      const buffer = new Buffer(JSON.stringify(data||{}));
      this._channel.publish(this._exchange, channelName, buffer);
    }
    
    _assertExchange() {
      this._channel.assertExchange(this._exchange, 'topic', {durable: false});
    }
    
    _handleMessage (channelName, message) {
      try {
        const data = JSON.parse(message);
        const event = { name: channelName };

        _.each(this._listeners[channelName]||[], (listener) => {
          listener(event, data);
        });
      } catch (e) {
        this._logger.error(e);
      }
    }
  
  };
  
  module.exports = function setup(options, imports, register) {
    const logger = imports['logger'];
    const amqpUrl = options['amqpUrl'];
    
    logger.info(util.format('Connecting to amqp server at %s', amqpUrl));
    
    amqp.connect(amqpUrl, (connectErr, connection) => {
      if (connectErr) {
        logger.error(util.format('Error occurred with connecting to amqp server: %s', connectErr));
      } else {
        logger.info('Connected to amqp server');
        logger.info('Creating amqp channel for shady-messages');
        connection.createChannel((channelErr, channel) => {
          if (channelErr) {
            logger.error(util.format('Error occurred while creating amqp channel: %s', channelErr));
          } else {
            logger.info('Amqp channel created for shady-messages');
            
            const instance = new ShadyMessages(logger, channel);

            register(null, {
              "shady-messages": instance
            });
          }
        });
      }
    });
  };

})();