/*
 * node-lazurite
 *
 * Copyright [Naotaka Saito]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

module.exports = function(config) {
	config = config || {};
	let node = this;
	const events = require("events");
	const emitter = new events.EventEmitter();
	const lib = require("./build/Release/lazurite_wrap");
	let isOpen = false;
	let timer = null;
	let isBegin = false;
	let be = config.be || false;					// for debug of endian
	let binaryMode = config.binaryMode;		// undef development
	let interval = config.interval || 10;

	/*
	 * #define EIO						5		// hardware error
	 * #define EAGAIN					11	// over 10% duty
	 * #define ENOMEM					12	// data size error
	 * #define EFAULT					14	// bad pointer
	 * #define EBUSY					16	// resource busy(CCA)
	 * #define EINVAL					22	// invalid parameters
	 * #define EFBIG					27	// File too large
	 * #define EDEADLK				35	// Resource deadlock would occur
	 * #define EBADE					52	// crc error
	 * #define EADDRNOTAVAIL	99	// Cannot assign requested address
	 * #define ETIMEDOUT			11	// no ack
	 */
	const ERROR = {
		"-5" : "hareware error",
		"-11" : "over 10% duty",
		"-12" : "data size error",
		"-14" : "bad pointer",
		"-16" : "CCA busy",
		"-22" : "invalid parameters",
		"-27" : "payload over size",
		"-35" : "unknown deadlock",
		"-52" : "crc error",
		"-99" : "address error",
		"-110" : "no ack",
	};

	node.init= function() {
		config = config || {};
		if(isOpen === false) {
			isOpen = true;
			if(!lib.dlopen()) {
				throw new Error("lazurite dlopen fail");
			}
			if(!lib.init()) {
				throw new Error("lazurite init fail");
			}
		}
	}
	node.begin = function(msg) {
		if(!msg.ch) {
			throw new Error("lazurite begin msg.ch is undefined");
		}
		if(!msg.panid) {
			throw new Error("lazurite begin msg.panid is undefined");
		}
		if(!msg.baud) {
			throw new Error("lazurite begin msg.baud is undefined");
		}
		if(!msg.pwr) {
			throw new Error("lazurite begin msg.pwr is undefined");
		}
		if(isBegin === true) {
			lib.close();
		}
		if(!lib.begin(msg.ch,msg.panid,msg.baud,msg.pwr)) {
			throw new Error("lazurite begin fail.");
		}
	}

	node.close = function() {
		if(isBegin === true) {
			isBegin = false;
			if(!lib.close()) {
				throw new Error("lazurite close fail.");
			}
		}
	}

	node.send64 = function(msg) {
		let ret;
		let dst_addr;
		let result = {};
		if(typeof msg.dst_addr === "string") {
			dst_addr = BigInt(msg.dst_addr);
		} else if(typeof msg.dst_addr === "number") {
			dst_addr = BigInt(msg.dst_addr);
		} else if(typeof msg.dst_addr === "bigint") {
			dst_addr = msg.dst_addr;
		} else {
			throw new Error('dst_addr format error');
		}
		let dst_array = [];
		for(let i = 0; i < 8 ; i++) {
			dst_array.push(parseInt(dst_addr%256n));
			dst_addr = (dst_addr >> 8n);
		}
		if(be === false) {
			ret = lib.send64le(dst_array,msg.payload);
		} else {
			let dst_be = [];
			for(let i = 0; i < 8 ; i++) {
				dst_be.push(dst_array[7-i]);
			}
			ret = lib.send64be(dst_be,msg.payload);
		}
		if(ret >= 0) {
			result.success = true;
			result.rssi = ret;
		} else {
			result.success = false;
			result.errcode = ret;
			result.errmsg = ERROR[ret];
		}
		return result;
	}

	node.send = function(msg) {
		let ret;
		let result = {};
		let dst_addr;
		if(typeof msg.dst_addr === "string") {
			dst_addr = BigInt(msg.dst_addr);
		} else {
			dst_addr = msg.dst_addr;
		}
		if(dst_addr > 65535) {
			let dst_array = [];
			for(let i = 0; i < 8 ; i++) {
				dst_array.push(parseInt(dst_addr%256n));
				dst_addr = (dst_addr >> 8n);
			}
			let 	tmp = "";
			for(let i = 7; i >= 0 ; i--) {
				tmp += ("00"+dst_array[i].toString(16)).substr(-2);
			}
			ret = lib.send64le(dst_array,msg.payload);
			if(ret >= 0) {
				result.success = true;
				result.rssi = ret;
			} else {
				result.success = false;
				result.errcode = ret;
				result.errmsg = ERROR[ret];
			}
		} else if(isNaN(msg.panid) === false) {
			ret = lib.send(parseInt(msg.panid),parseInt(msg.dst_addr),msg.payload);
			if(ret >= 0) {
				result.success = true;
				result.rssi = ret;
			} else {
				result.success = false;
				result.errcode = ret;
				result.errmsg = ERROR[ret];
			}
			if(ret > 0 ) {
				result.eack = lib.getEnhanceAck();
			}
		} else {
			throw new Error("lazurite send msg.panid error.\nmsg.dst_addr > 65535 : 64bit addressing mode. msg.panid is not required.\nmsg.dst_addr <= 65535 : short addressing mode. msg.panid is required.\nif force to send 64bit addressing mode in case of msg.dst_addr <=65535,please use send64")
		}
		return result;
	}

	node.rxEnable = function() {
		if(!lib.rxEnable()) {
			throw new Error("lazurite rxEnable fail.");
		};
	}

	node.rxDisable = function() {
		if(!lib.rxDisable()) {
			throw new Error("lazurite rxDisable fail.");
		}
	}

	node.getMyAddr64 = function() {
		let myaddr64 = lib.getMyAddr64();
		let d = "0x";
		for(let a of myaddr64) {
			d = d + ("00"+a.toString(16)).substr(-2);
		}
		return d;
	}

	node.getMyAddress = function() {
		return lib.getMyAddress();
	}

	node.setMyAddress = function(a) {
		if(isNaN(a) === true) {
			throw new Error("lazurite setMyAddress panid is not a number");
		}
		return lib.setMyAddress(parseInt(a));
	}

	node.setAckReq = function(on) {
		if(typeof on !== "boolean") {
			throw new Error("lazurite setAckReq must be boolean");
		}
		return lib.setAckReq(on);
	}

	node.setBroadcastEnb = function(on) {
		if(typeof on !== "boolean") {
			throw new Error("lazurite setBroadcastEnb must be boolean");
		}
		return lib.setBroadcastEnb(on);
	}

	/* setKey format
	 *  input :	"" : aes off
	 *  				128bit(16byte HEX string)
	 */
	node.setKey = function(key) {
		if(typeof key !== "string"){
			throw new Error("key must be string and the length is 32");
		}
		return lib.setKey(key);
	}

	/* setEnhanceAck format
	 *  input: [
	 *  	{
	 *  		addr: (target short address),
	 *  		data: [ enhance ack data array (uint_8). max length = 16 ]
	 *  	},
	 *  	....
	 *  	{
	 *  		addr: 0xFFFF,					// in case of address unmatch
	 *  		data: [ enhance ack data array (uint_8). max length = 16 ]
	 *  	}
	 *  ]
	 *
	 *  output: Uint8Array [
	 *  	[headr]
	 *  	0: lower byte of device count
	 *  	1: upper byte of device count
	 *  	2: lower byte of ack size
	 *  	3: uptter byte of ack size
	 *  	[data]
	 *		4 + n * (ackSize + 2) + 0: lower byte of target short address
	 *		4 + n * (ackSize + 2) + 1: upper byte of target short address
	 *		4 + n * (ackSize + 2) + 2: ack data[0]
	 *		4 + n * (ackSize + 2) + 3: ack data[1]
	 *		...
	 *  ]
	 */
	node.setEnhanceAck = function(eack) {
		let devCount = eack.length;
		let ackSize = eack[0].data.length;
		if((devCount == 0) || (ackSize == 0)) {
			lib.setEnhanceAck(null,0);
			return;
		}
		if(ackSize > 16) {
			lib.setEnhanceAck(null,0);
			throw new Error('EnhanceAck length error');
		}
		let buffSize =  devCount * (ackSize + 2)  + 4;
		let buffer = new ArrayBuffer(buffSize);
		let uint8Array = new Uint8Array(buffer,0,buffSize);
		let index = 4;
		uint8Array[0] = devCount&0x0ff;
		uint8Array[1] = devCount >> 8;
		uint8Array[2] = ackSize&0x0ff;
		uint8Array[3] = ackSize >> 8;
		for(var d of eack) {
			if(ackSize != d.data.length) {
				lazurite.lib.setEnhanceAck(null,0);
				throw new Error(`Lazurite EnhanceAck different length is included. ${d}`);
			}
			uint8Array[index] = d.addr&0x0ff,index += 1;
			uint8Array[index] = d.addr>>8,index += 1;
			for(var a of d.data) {
				uint8Array[index] = a,index += 1;
			}
		}
		lib.setEnhanceAck(uint8Array,buffSize);
	}

	node.setPromiscuous = function(on) {
		if(isBegin) {
			throw new Error("lazurite setPromiscous can be change after close");
		}
		return lib.setPromisecous(on);
	}

	node.on = function(type,callback) {
		if(type === "rx") {
			if(timer === null) {
				timer = setInterval(timerFunc,interval);
			}
			emitter.on(type,callback);
		}
	}

	node.removeListener = function(type,listener) {
		emitter.removeListener(type,listener);
		if(emitter.listenerCount("rx") === 0) {
			clearInterval(timer);
			timer = null;
		}
	}

	node.remove = function() {
		if(isOpen === true) {
			if(timer) clearInterval(timer);
			emitter.removeAllListeners();
			lib.close();
			isBegin = false;
			lib.remove();
			isOpen = false;
		}
	}

	function timerFunc() {
		let data = lib.read(node.binaryMode);
		if(data.payload.length > 0) {
			for(let d of data.payload) {
				let addr;
				if(d.src_addr.length === 8) {
					addr = BigInt(0);
					for(let i = d.src_addr.length -1 ; i >= 0; i--) {
						addr = addr*256n + BigInt(d.src_addr[i]);
					}
				} else {
					addr = 0;
					for(let i = d.src_addr.length -1 ; i >= 0; i--) {
						addr = addr*256 + d.src_addr[i];
					}
				}
				d.src_addr = addr;
				if(d.dst_addr.length === 8) {
					addr = BigInt(0);
					for(let i = d.dst_addr.length-1; i >= 0; i--) {
						addr = addr*256n + BigInt(d.dst_addr[i]);
					}
				} else {
					addr = 0;
					for(let i = d.dst_addr.length-1; i >= 0; i--) {
						addr = addr*256 + d.dst_addr[i];
					}
				}
				d.dst_addr = addr;
				d.rxtime = d.sec* 1000+parseInt(d.nsec/1000000);
				delete d.sec;
				delete d.nsec;
				emitter.emit("rx",d);
			}
		}
	}
	return node;
}

