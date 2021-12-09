#!/usr/bin/env node

// https://cirosantilli.com/express-js

const nodemailer = require('nodemailer');
const nodemailerMailgunTransport = require('nodemailer-mailgun-transport');

const express = require('express')

// Test it.
function test(path, method, status, body) {
  const assert = require('assert')
  const http = require('http')
  const options = {
    hostname: 'localhost',
    port: server.address().port,
    path: path,
    method: method,
  }
  http.request(options, res => {
    console.log([path, method, status, body]);
    assert.strictEqual(res.statusCode, status);
    res.on('data', d => {
      if (body !== undefined) {
        assert.strictEqual(d.toString(), body);
      }
    })
  }).end()
}

function check_helper(req, res) {
  if (req.params.param.length > 2) {
    res.status(404)
    res.send('ko')
  } else {
    return req.params.param + 'ok'
  }
}

const tests = [
  ['/hello', 'GET', 200, 'hello world'],
  ['/env', 'GET', 200],
  ['/', 'POST', 404],
  ['/dontexist', 'GET', 404],

  ['/query?aa=000&bb=111', 'GET', 200, 'aa: 000 bb: 111'],

  // https://stackoverflow.com/questions/10020099/express-js-routing-optional-splat-param
  // https://stackoverflow.com/questions/16829803/express-js-route-parameter-with-slashes
  // https://stackoverflow.com/questions/34571784/how-to-use-parameters-containing-a-slash-character
  ['/splat/aaa', 'GET', 200, 'splat aaa'],
  ['/splat/aaa/bbb', 'GET', 200, 'splat aaa/bbb'],
  ['/splat/aaa/bbb/ccc', 'GET', 200, 'splat aaa/bbb/ccc'],

  ['/check-helper-1/aa', 'GET', 200, 'aaok'],
  ['/check-helper-2/bb', 'GET', 200, 'bbok'],
  ['/check-helper-1/ccc', 'GET', 404, 'ko'],
  ['/check-helper-2/ddd', 'GET', 404, 'ko'],

  // Shows stack traceon terminal.
  ['/error', 'GET', 500],

  // Shows stack traceon terminal.
  ['/error/custom-handler', 'GET', 500],

  // The default handler inspects the .status
  // property of the error. 4xx and 5xx are kept.
  // everything else is replaced with 500.
  ['/error/code/404', 'GET', 404],
  ['/error/code/505', 'GET', 505],
  ['/error/code/606', 'GET', 500],

  // Email tests.
  ['/mailgun', 'GET', 200],
  ['/mailgun', 'POST', 200],
]

// This is your API key that you retrieve from www.mailgun.com/cp (free up to 10K monthly emails)
let nodemailerMailgun
if (process.env.MAILGUN_API_KEY !== undefined) {
  nodemailerMailgun = nodemailer.createTransport(nodemailerMailgunTransport({
    auth: {
      api_key: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN,
    }
  }))
}

const app = express()
app.use(express.urlencoded({ extended: false }))
app.get('/', (req, res) => {
  res.send(`
<html lang=en>
<head>
<meta charset=utf-8>
<title>Min sane</title>
</head>
<body>
<ul>
${tests.filter(t => t[1] === 'GET').map(t => `<li><a href="${t[0]}">${t[0]}</a></li>`).join('\n')}
</ul>
</body>
</html>
`)
})
app.get('/env', (req, res) => {
  const env = [];
  for (const key of Object.keys(process.env).sort()) {
    env.push(`${key}: ${process.env[key]}`);
  }
  console.log(env.join('\n'))
  res.send('env vars printed to console')
})
app.get('/hello', (req, res) => {
  res.send('hello world')
})
app.get('/check-helper-1/:param', (req, res) => {
  const ret = check_helper(req, res)
  if (ret) {
    res.send(ret)
  }
})
app.get('/check-helper-2/:param', (req, res) => {
  const ret = check_helper(req, res)
  if (ret) {
    res.send(ret)
  }
})
app.get('/query', (req, res) => {
  res.send(`aa: ${req.query.aa} bb: ${req.query.bb}`)
})
app.get('/splat/:splat(*)', (req, res) => {
  res.send('splat ' + req.params.splat)
})

// Error cases.
app.get('/error', async (req, res, next) => {
  try {
    asdfqwer
  } catch(error) {
    next(error);
  }
})
app.get('/error/code/:param', async (req, res, next) => {
  try {
    throw {
      status: parseInt(req.params.param, 10),
      stack: `fake stack ${req.params.param}`
    }
  } catch(error) {
    next(error);
  }
})
app.get('/error/custom-handler',
  async (req, res, next) => {
    try {
      asdfqwer
    } catch(error) {
      next(error);
    }
  },
  async (err, req, res, next) => {
    res.locals.msg = ['Custom handler']
    next(err)
  },
  async (err, req, res, next) => {
    res.locals.msg.push('Custom handler 2')
    res.status(500).send(res.locals.msg.join('\n'))
  }
)
app.get('/mailgun', (req, res) => {
  res.send(`<!doctype html>
<html lang=en>
<head>
<meta charset=utf-8>
<title>Min sane</title>
</head>
<body>
<form action="/mailgun" method="post">
  <input type="email" name="to" placeholder="To email"><br>
  <input type="text" name="title" placeholder="Title"><br>
  <input type="password" name="password" placeholder="Password"><br>
  <textarea name="body" rows="5">Body

of email</textarea><br>
  <input type="submit" value="Send email to Ciro">
</form>
</body>
</html>
`)
})
app.post('/mailgun', (req, res) => {
  if (
    req.body.password === process.env.SECRET_PASSWORD &&
    process.env.MAILGUN_API_KEY !== undefined
  ) {
    console.log('will send mailgun');
    nodemailerMailgun.sendMail({
      from: 'ciro@' + process.env.MAILGUN_DOMAIN,
      to: req.body.to,
      subject: req.body.title,
      text: req.body.body,
    }, (err, info) => {
      if (err) {
        console.log(`mailgun error: ${err}`);
      } else {
        console.log(`mailgun success: ${info}`);
      }
    });
  }
  res.redirect('/mailgun')
})

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`listening: http://localhost:${server.address().port}`)
})
