/*
 * node-lazurite
 *
 * preriminary version
 *
 * not implemented
 *  setKey(key)
 *  setBroadcastEnb(on)
 *  setPromiscous(on)
 *  setEnhanceAck(eack)
 *  getEnhanceAck()
 *
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
	let isRxEnable = false;
	let be = config.be || false;					// for debug of endian
	let binaryMode = config.binaryMode;		// undef development
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
	node.send64 = function(msg) {
		let ret;
		let dst_addr;
		if(typeof msg.dst_addr === "string") {
			dst_addr = BigInt(msg.dst_addr);
		} else {
			dst_addr = msg.dst_addr;
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
		return ret;
	}
	node.send = function(msg) {
		let ret;
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
		} else if(isNaN(msg.panid) === false) {
			ret = lib.send(parseInt(msg.panid),parseInt(msg.dst_addr),msg.payload);
		} else {
			throw new Error("lazurite send msg.panid error.\nmsg.dst_addr > 65535 : 64bit addressing mode. msg.panid is not required.\nmsg.dst_addr <= 65535 : short addressing mode. msg.panid is required.\nif force to send 64bit addressing mode in case of msg.dst_addr <=65535,please use send64")
		}
		return ret;
	}
	node.on = function(type,callback) {
		if(type === "rx") {
			if(timer === null) {
				timer = setInterval(timerFunc,10);
			}
			emitter.on(type,callback);
		}
	}
	node.rxEnable = function() {
		if(isRxEnable === false) {
			if(!lib.rxEnable()) {
				throw new Error("lazurite rxEnable fail.");
			};
		}
	}
	node.rxDisable = function() {
		if(isRxEnable === true) {
			if(!lib.rxDisable()) {
				throw new Error("lazurite rxDisable fail.");
			}
		}
	}
	node.removeListener = function(type,listener) {
		emitter.removeListener(type,listener);
		if(emitter.listenerCount("rx") === 0) {
			clearInterval(timer);
			timer = null;
		}
	}
	node.close = function() {
		if(isBegin === true) {
			isBegin = false;
			if(!lib.close()) {
				throw new Error("lazurite close fail.");
			};
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
				let addr=0;
				for(let i = d.src_addr.length -1 ; i >= 0; i--) {
					addr = addr*256 + d.src_addr[i];
				}
				d.src_addr = addr;
				addr = 0;
				for(let i = d.dst_addr.length-1; i >= 0; i--) {
					addr = addr*256 + d.dst_addr[i];
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

