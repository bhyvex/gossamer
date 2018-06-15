import Ember from 'ember'
import uuid from 'npm:uuid'
import moment from 'moment'
import * as nc from 'npm:node-cidr'

export default Ember.Controller.extend({
  protocol: '',
  icmptype: null,
  icmpcode: null,
  tcpflags: [],
  isdefDur: false,

  uid: Ember.computed('session', function () {
    return `${this.get('session.data.authenticated.uid')}`
  }),

  usrtype: Ember.computed('uid', function () {
    let uid = this.get('uid')
    return `${this.get('store').peekRecord('user', uid).get('kind')}`
  }),

  usrNetworks: Ember.computed('uid', function () {
    let uid = this.get('uid')
    let usrNets = []
    this.get('store').peekRecord('user', uid).get('networks').forEach(function (item) {
      usrNets.push(item.get('net'))
    })
    // Ember.Logger.info(cidr)
    return usrNets
  }),

  coid: Ember.computed('uid', function () {
    let uid = this.get('uid')
    return `${this.get('store').peekRecord('user', uid).get('customerid')}`
  }),

  couuid: Ember.computed('uid', function () {
    let uid = this.get('uid')
    return `${this.get('store').peekRecord('user', uid).get('couuid')}`
  }),

  mnow: moment.now(),
  mnowef10m: Ember.computed('mnow', function () {
    return this.get('mnow') + 600000
  }),

  isdefDurChanged: Ember.on('init', Ember.observer('isdefDur', function () {
    let uptime = function () {
      if (this.get('isdefDur')) {
        this.set('mnow', moment.now())
      }
      this._timer = setTimeout(uptime, 1000)
    }.bind(this)
    uptime()
  })),

  fromDate: Ember.computed('mnow', function () {
    let d = new Date(this.get('mnow'))
    return d
  }),
  toDate: Ember.computed('mnowef10m', function () {
    let d = new Date(this.get('mnowef10m'))
    return d
  }),
  extractDate (dt) {
    let exdt = Array.isArray(dt) ? dt[0] : dt
    return exdt
  },

  ruleact: 'discard',

  resact: Ember.computed('ruleact', function () {
    let act = this.get('ruleact')
    let react = 'discard'
    if (act === 'rate limit') {
      react = `${act} ${this.get('pktrate')}`
    }
    return `${react}`
  }),

  responseMessage: '',

  validated: true,

  willDestry () {
    this._super(...arguments)
    this.set('isdefDur', false)
    clearTimeout(this.get('_timer'))
  },

  actions: {
    resetForm () {
      this.setProperties({
        protocol: null,
        srcip: null,
        srcport: null,
        destip: null,
        destport: null,
        tcpflags: [],
        icmptype: null,
        icmpcode: null,

        pktlen: null,
        fragenc: null,
        shrtcomm: null,
        isdefDur: false,
        ruleact: 'discard',
        pktrate: 0
      })
    },

    setMinDate () {
      this.set('toMinDate', this.get('fromDate'))
    },

    validateNetwork () {
      Ember.Logger.info('Entered cidr/ip: ', this.get('destip'))
    },

    createRule () {
      let ruuid = uuid.v4()
      let fxExDt = this.get('extractDate')
      let matchedNetworks = this.get('usrNetworks').map((e) => nc.default.cidr.includes(e, this.get('destip')))
      let ifNetBelongsToUser = matchedNetworks.indexOf(true) !== -1
      Ember.Logger.info(ifNetBelongsToUser)
      if (ifNetBelongsToUser) {
        let rule = this.get('store').createRecord('rule', {
          ruleuuid: ruuid,
          couuid: this.get('couuid'),
          userid: this.get('uid'),
          validfrom: fxExDt(this.get('fromDate')).toISOString(),
          validto: fxExDt(this.get('toDate')).toISOString(),
          srcprefix: this.get('srcip') || null,
          srcport: this.get('srcport') || null,
          destprefix: this.get('destip'),
          destport: this.get('destport'),
          ipprotocol: this.get('protocol'),
          icmptype: this.get('icmptype'),
          icmpcode: this.get('icmpcode'),
          tcpflags: this.get('tcpflags').join().toLowerCase(),
          description: this.get('shrtcomm'),
          pktlen: this.get('pktlen'),
          action: this.get('resact')
        })

        rule.save()
      .then((response) => {
        let ruleprcl = response.get('store').peekRecord('rule', response.get('id')).get('ipprotocol').toUpperCase()
        this.set('responseMessage',
          `A ${ruleprcl} was created successfully on ${response.get('store').peekRecord('rule', response.get('id')).get('destprefix')}`)
        this.get('notifications').clearAll()
        this.get('notifications').success(this.get('responseMessage'), {
          autoClear: true,
          clearDuration: 5000
        })
      })
      .catch((adapterError) => {
        Ember.Logger.info(adapterError)

        this.get('notifications').clearAll()
        this.get('notifications').error('Something went wrong on create!', {
          autoClear: true,
          clearDuration: 10000
        })
      })
      }
    }
  }
})
