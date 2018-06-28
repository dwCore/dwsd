var tape = require('tape')
var dws2 = require('@dwcore/dws2')
var dwebStreamChain = require('@dwcore/dws-chain')
var net = require('net')
var dwsd = require('./')

var HELLO_WORLD = (Buffer.from && Buffer.from !== Uint8Array.from)
 ? Buffer.from('hello world')
 : new Buffer('hello world')

tape('passthrough', function(t) {
  t.plan(2)

  var pt = dws2()
  var dws2Duplex = dwsd(pt, pt)

  dws2Duplex.end('hello world')
  dws2Duplex.on('finish', function() {
    t.ok(true, 'should finish')
  })
  dws2Duplex.pipe(dwebStreamChain(function(data) {
    t.same(data.toString(), 'hello world', 'same in as out')
  }))
})

tape('passthrough + double end', function(t) {
  t.plan(2)

  var pt = dws2()
  var dws2Duplex = dwsd(pt, pt)

  dws2Duplex.end('hello world')
  dws2Duplex.end()

  dws2Duplex.on('finish', function() {
    t.ok(true, 'should finish')
  })
  dws2Duplex.pipe(dwebStreamChain(function(data) {
    t.same(data.toString(), 'hello world', 'same in as out')
  }))
})

tape('async passthrough + end', function(t) {
  t.plan(2)

  var pt = dws2.obj({highWaterMark:1}, function(data, enc, cb) {
    setTimeout(function() {
      cb(null, data)
    }, 100)
  })

  var dws2Duplex = dwsd(pt, pt)

  dws2Duplex.write('hello ')
  dws2Duplex.write('world')
  dws2Duplex.end()

  dws2Duplex.on('finish', function() {
    t.ok(true, 'should finish')
  })
  dws2Duplex.pipe(dwebStreamChain(function(data) {
    t.same(data.toString(), 'hello world', 'same in as out')
  }))
})

tape('duplex', function(t) {
  var readExpected = ['read-a', 'read-b', 'read-c']
  var writeExpected = ['write-a', 'write-b', 'write-c']

  t.plan(readExpected.length+writeExpected.length+2)

  var dwReadable = dws2.obj()
  var dwWritable = dws2.obj(function(data, enc, cb) {
    t.same(data, writeExpected.shift(), 'onwrite should match')
    cb()
  })

  var dws2Duplex = dwsd.obj(dwWritable, dwReadable)

  readExpected.slice().forEach(function(data) {
    dwReadable.write(data)
  })
  dwReadable.end()

  writeExpected.slice().forEach(function(data) {
    dws2Duplex.write(data)
  })
  dws2Duplex.end()

  dws2Duplex.on('data', function(data) {
    t.same(data, readExpected.shift(), 'ondata should match')
  })
  dws2Duplex.on('end', function() {
    t.ok(true, 'should end')
  })
  dws2Duplex.on('finish', function() {
    t.ok(true, 'should finish')
  })
})

tape('async', function(t) {
  var dws2Duplex = dwsd()
  var pt = dws2()

  dws2Duplex.pipe(dwebStreamChain(function(data) {
    t.same(data.toString(), 'i was async', 'same in as out')
    t.end()
  }))

  dws2Duplex.write('i')
  dws2Duplex.write(' was ')
  dws2Duplex.end('async')

  setTimeout(function() {
    dws2Duplex.setDwWritable(pt)
    setTimeout(function() {
      dws2Duplex.setDwReadable(pt)
    }, 50)
  }, 50)
})

tape('destroy', function(t) {
  t.plan(2)

  var write = dws2()
  var read = dws2()
  var dws2Duplex = dwsd(write, read)

  write.destroy = function() {
    t.ok(true, 'write destroyed')
  }

  dws2Duplex.on('close', function() {
    t.ok(true, 'close emitted')
  })

  dws2Duplex.destroy()
  dws2Duplex.destroy() // should only work once
})

tape('destroy both', function(t) {
  t.plan(3)

  var write = dws2()
  var read = dws2()
  var dws2Duplex = dwsd(write, read)

  write.destroy = function() {
    t.ok(true, 'write destroyed')
  }

  read.destroy = function() {
    t.ok(true, 'read destroyed')
  }

  dws2Duplex.on('close', function() {
    t.ok(true, 'close emitted')
  })

  dws2Duplex.destroy()
  dws2Duplex.destroy() // should only work once
})

tape('bubble read errors', function(t) {
  t.plan(2)

  var write = dws2()
  var read = dws2()
  var dws2Duplex = dwsd(write, read)

  dws2Duplex.on('error', function(err) {
    t.same(err.message, 'read-error', 'received read error')
  })
  dws2Duplex.on('close', function() {
    t.ok(true, 'close emitted')
  })

  read.emit('error', new Error('read-error'))
  write.emit('error', new Error('write-error')) // only emit first error
})

tape('bubble write errors', function(t) {
  t.plan(2)

  var write = dws2()
  var read = dws2()
  var dws2Duplex = dwsd(write, read)

  dws2Duplex.on('error', function(err) {
    t.same(err.message, 'write-error', 'received write error')
  })
  dws2Duplex.on('close', function() {
    t.ok(true, 'close emitted')
  })

  write.emit('error', new Error('write-error'))
  read.emit('error', new Error('read-error')) // only emit first error
})

tape('reset writable / readable', function(t) {
  t.plan(3)

  var toUpperCase = function(data, enc, cb) {
    cb(null, data.toString().toUpperCase())
  }

  var passthrough = dws2()
  var upper = dws2(toUpperCase)
  var dws2Duplex = dwsd(passthrough, passthrough)

  dws2Duplex.once('data', function(data) {
    t.same(data.toString(), 'hello')
    dws2Duplex.setDwWritable(upper)
    dws2Duplex.setDwReadable(upper)
    dws2Duplex.once('data', function(data) {
      t.same(data.toString(), 'HELLO')
      dws2Duplex.once('data', function(data) {
        t.same(data.toString(), 'HI')
        t.end()
      })
    })
    dws2Duplex.write('hello')
    dws2Duplex.write('hi')
  })
  dws2Duplex.write('hello')
})

tape('cork', function(t) {
  var passthrough = dws2()
  var dws2Duplex = dwsd(passthrough, passthrough)
  var ok = false

  dws2Duplex.on('prefinish', function() {
    dws2Duplex.cork()
    setTimeout(function() {
      ok = true
      dws2Duplex.uncork()
    }, 100)
  })
  dws2Duplex.on('finish', function() {
    t.ok(ok)
    t.end()
  })
  dws2Duplex.end()
})

tape('prefinish not twice', function(t) {
  var passthrough = dws2()
  var dws2Duplex = dwsd(passthrough, passthrough)
  var prefinished = false

  dws2Duplex.on('prefinish', function() {
    t.ok(!prefinished, 'only prefinish once')
    prefinished = true
  })

  dws2Duplex.on('finish', function() {
    t.end()
  })

  dws2Duplex.end()
})

tape('close', function(t) {
  var passthrough = dws2()
  var dws2Duplex = dwsd(passthrough, passthrough)

  passthrough.emit('close')
  dws2Duplex.on('close', function() {
    t.ok(true, 'should forward close')
    t.end()
  })
})

tape('works with node native streams (net)', function(t) {
  t.plan(1)

  var server = net.createServer(function(socket) {
    var dws2Duplex = dwsd(socket, socket)

    dws2Duplex.once('data', function(chunk) {
      t.same(chunk, HELLO_WORLD)
      server.close()
      socket.end()
      t.end()
    })
  })

  server.listen(0, function () {
    var socket = net.connect(server.address().port)
    var dws2Duplex = dwsd(socket, socket)

    dws2Duplex.write(HELLO_WORLD)
  })
})
