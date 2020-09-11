'use strict'
const LAZURITE = require("../");

// Initialize
// options.be							false(default): little endian,    true: little endian
// options.binaryMode			false(default): payload = string, true: binary mode (under develop)
// options.interval				ms of read interval time. default = 10(ms)
//
let options;
let lazurite = new LAZURITE(options);
lazurite.init();

// set my short address before lazurite.begin
lazurite.setMyAddress(0xfff0);
// check my MAC address
console.log(lazurite.getMyAddr64());
// check my short address
console.log(`0x${('0000'+lazurite.getMyAddress().toString(16)).substr(-4)}`);
const keybase = "07a45e454318b6d4a9d5449f3b342bda";
const dest = "0x001d129000038e6d";

let keyOn = true;
lazurite.setKey(keybase);

lazurite.setAckReq(true);

// initialize rf
lazurite.begin({
	ch: 36,						// channel
	panid: 0xabcd,		// panid
	baud: 100,				// baud rate
	pwr: 20						// power
});

// start rx start
lazurite.on("rx",callback);		// entry callback of rx
lazurite.rxEnable();					// rx start

// callback for rx
function callback(msg) {
	let src_len = msg.src_addr>65535 ? 16 : 4;
	let dst_len = msg.dst_addr>65535 ? 16 : 4;
	console.log({
		panid: `0x${("0000"+msg.dst_panid.toString(16)).substr(-4)}`,
		src_addr: `0x${("0000"+msg.src_addr.toString(16)).substr(src_len*-1)}`,
		dst_addr: `0x${("0000"+msg.dst_addr.toString(16)).substr(dst_len*-1)}`,
		paylod: msg.payload,
		seq_num: msg.seq_num,
		rssi: msg.rssi,
		rxtime: (new Date(msg.rxtime)).toLocaleString(),
		raw: msg
	});
}

// tx process
let timer = null;
let i = 0;
timer = setInterval(function() {
	funcarray[i](i);
	i+=1;
	if(i >= funcarray.length) {
		i = 0;
	}
},1000);

// sample of tx
//unicast by short adressing mode

function send_0(n) {
	if(keyOn) {
		keyOn = false;
		lazurite.setKey("");
	} else {
		keyOn = true;
		lazurite.setKey(keybase);
	}
	let ret = lazurite.send({
		panid : 0xabcd,											// panid
		dst_addr : 0x0001,									// short address of destination
		payload: "send_0"	// payload
	});
	ret.func = funcarray[n].name;
	console.log(ret);
}
//group cast
function send_1(n) {
	let ret = lazurite.send({
		panid : 0xabcd,											// panid
		dst_addr : 0xffff,									// all in pan
		payload: "send_1"	// payload
	});
	ret.func = funcarray[n].name;
	console.log(ret);
}
//
//broadcast cast
function send_2(n) {
	let ret = lazurite.send({
		panid : 0xffff,											// global panid
		dst_addr : 0xffff,									// global address
		payload: "send_2"	// payload
	});
	ret.func = funcarray[n].name;
	console.log(ret);
}
//example of 64bit adressing mode
function send_3(n) {
	let ret = lazurite.send({							// automatically use send64
		dst_addr : dest,										// 64bit mac address of destination
		payload: "send_3"	// payload
	});
	ret.func = funcarray[n].name;
	console.log(ret);
}
//example of 64bit adressing mode
function send_4(n) {
	let ret = lazurite.send64({							// force to use 64bit addressing mode
		dst_addr : dest,											// 64bit mac address of destination
		payload: "send_4"		// payload
	});
	ret.func = funcarray[n].name;
	console.log(ret);
}
let funcarray = [
	send_0,
	send_1,
	send_2,
	send_3,
	send_4
];

// process exit process
process.on("SIGINT",function(code) {
	console.log("lazurite.remove");
	clearInterval(timer);
	lazurite.remove();
});

