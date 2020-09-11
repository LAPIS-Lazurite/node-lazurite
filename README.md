# node-lazurite
node for LazDriver by v8

node-lazuriteはnode.jsで動作するlazuriteのドライバインタフェースです。
サンプルはexample/sampLe_trx.jsを参照してください。

## 1. 初期化

| 関数 |parameters | 機能 |
| --- | --- | --- |
| (create) | options.interval | 読み出しインターバルです。デフォルトでは10ms間隔でデータの有無をチェックしています |
| (create) | options.be | 送信時の関数にsend64beを指定するときに使用します。通常は設定不要です。|
| (create) | options.binaryMode | 開発中の機能 |
| init | -- | ドライバーのロードやハードウエアの初期化を行います |


```js
const LAZURITE = require("node-lazurite");

// Initialize
// options.be							false(default): little endian,    true: little endian
// options.binaryMode			false(default): payload = string, true: binary mode (under develop)
// options.interval				ms of read interval time. default = 10(ms)
let options;
let lazurite = new LAZURITE(options);
lazurite.init();
```

## 2. アドレスの設定や確認

| 関数 |parameters | 機能 |
| --- | --- | --- |
| getMyAddress64() | --- | 64bit MACアドレス(BigInt型整数)を取得します。 |
| getMyAddress() | 戻り値 | 16bit short addressを取得します|
| setMyAddress(addr) | addr | 16bit short addressを設定します |

```js
// set my short address before lazurite.begin
lazurite.setMyAddress(0xfff0);
// check my MAC address
console.log(lazurite.getMyAddr64());
// check my short address
console.log(`0x${('0000'+lazurite.getMyAddress().toString(16)).substr(-4)}`);
```

## 3. 無線の初期化

| 関数 |parameters | 機能 |
| --- | --- | --- |
| begin(params) | params.ch | 使用するチャンネル(周波数)を指定します |
| begin(params) | params.panid | 16bit PANID(任意の0-0xFFFDまたは所属するPANのIDを指定します。|
| begin(params) | params.baud | 50 : 50kbps,  100 : 100kbps|
| begin(params) | params.pwr | 20 : 20mw ,      1 : 1mw|

```js
// initialize rf
lazurite.begin({
	ch: 36,						// channel
	panid: 0xabcd,		// panid
	baud: 100,				// baud rate
	pwr: 20						// power
});
```

## 4. 受信用イベントハンドラの登録と受信の有効化

```js
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
```
## 5. 送信
timerに送信関数を登録して繰り返し送信するサンプルです。
送信モードの設定は各send関数を参照してください。

```js
// tx process
let timer = null;
timer = setInterval(send_1,1000);
```

### 5-1.  ショートアドレスによるユニキャスト
PANIDとショートアドレスを使用したユニキャスト(1対1通信)
戻値は受信したACKのRSSIになります。

```js
//unicast by short adressing mode
function send_1() {
	let ret = lazurite.send({
		panid : 0xabcd,											// panid
		dst_addr : 0x054c,									// short address of destination
		payload: "hello from node-lazurite"	// payload
	});
	console.log(ret);
}
```

### 5-2.  グループキャスト
PAN加入の全てが受信するグループキャストです。
送信先のアドレスには0xFFFFを指定してください。
戻値は0になります。

```js
//group cast
function send_2() {
	let ret = lazurite.send({
		panid : 0xabcd,											// panid
		dst_addr : 0xffff,									// all in pan
		payload: "hello from node-lazurite"	// payload
	});
	console.log(ret);
}
```

### 5-3.  ブロードキャスト
全端末が受信できるブロードキャストです。
PANIDおよび送信先のアドレスを双方とも0xFFFFにしてください。
戻値は0になります。

```js
//broadcast cast
function send_3() {
	let ret = lazurite.send({
		panid : 0xffff,											// global panid
		dst_addr : 0xffff,									// global address
		payload: "hello from node-lazurite"	// payload
	});
	console.log(ret);
}
```

### 5-4.  64bit MACアドレスを使用したユニキャスト(1)
64bit MACアドレスを指定するユニキャストです。
dst_addrが65536以上のとき、自動的に64bit MACアドレスと認識してユニキャストで送信します。
このときPANIDは0xFFFFに指定されます。
戻値はRSSIを示します。

```js
//example of 64bit adressing mode
function send_4() {
	let ret = lazurite.send({							// automatically use send64
		dst_addr : "0x001d12d00500054c",		// 64bit mac address of destination
		payload: "hello from node-lazurite"	// payload
	});
	console.log(ret);
}
```

### 5-5.  64bit MACアドレスを使用したユニキャスト(2)
64bit MACアドレスを指定するユニキャストです。
send64関数を使用することで確実に64bit MACアドレスでユニキャストします。
このときPANIDは0xFFFFに指定されます。
戻値は受信したACKのRSSIになります。

```js
//example of 64bit adressing mode
function send_5() {
	let ret = lazurite.send64({							// force to use 64bit addressing mode
		dst_addr : "0x001d12d00500054c",			// 64bit mac address of destination
		payload: "hello from node-lazurite"		// payload
	});
	console.log(ret);
}
```

#6. 終了処理
終了処理です。本サンプルではCtrl+Cを押したときに終了処理が実行されます。

```js
// process exit process
process.on("SIGINT",function(code) {
	console.log("lazurite.remove");
	clearInterval(timer);
	lazurite.remove();
});
```

