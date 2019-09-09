import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import styled from 'styled-components'

function App() {
  return <div>miobot</div>
}

// auth callback
function Callback() {
  const accessToken = window.location.hash.match(/access_token=(.+?)[&$]/)[1]
  const state = window.location.hash.match(/state=(.+?)[&$]/)[1]
  const expiresIn = parseInt(
    window.location.hash.match(/expires_in=(.+?)$/)[1],
    10
  )
  console.log(accessToken)
  console.log(state)
  const result = btoa(
    JSON.stringify({ token: accessToken, sig: state, exp: expiresIn })
  )
  return (
    <Container>
      <Title>Telegramに戻って、以下のトークンを貼り付けてください。</Title>
      <TokenContainer>{result}</TokenContainer>
    </Container>
  )
}

const Title = styled.h4`
  font-family: sans-serif;
`

const Container = styled.div`
  padding: 100px;
`

const TokenContainer = styled.code`
  word-wrap: break-word;
  user-select: all;
`

function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={App} />
        <Route path="/callback" component={Callback} />
      </Switch>
    </Router>
  )
}

ReactDOM.render(<AppRouter />, document.getElementById('root'))
