import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import Welcome from './components/Welcome'
import Callback from './components/Callback'

function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={Welcome} />
        <Route path="/callback" component={Callback} />
      </Switch>
    </Router>
  )
}

ReactDOM.render(<AppRouter />, document.getElementById('root'))
