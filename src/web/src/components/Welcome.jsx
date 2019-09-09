import React from 'react'
import styled from 'styled-components'

export default function Welcome() {
  return (
    <Container>
      <h1>miobot</h1>
      <a href="https://t.me/mio_autobot">
        <img
          src="https://img.shields.io/badge/add_to-Telegram-2CA5E0?logo=telegram&style=flat-square"
          alt="Telegram"
        />
      </a>
    </Container>
  )
}

const Container = styled.div`
  font-family: sans-serif;
  padding: 50px;
`
