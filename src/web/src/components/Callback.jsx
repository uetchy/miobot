import React from 'react'
import styled from 'styled-components'

// auth callback
export default function Callback() {
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
  padding: 50px;
`

const TokenContainer = styled.div`
  font-family: monospace;
  word-wrap: break-word;
  user-select: all;
`
