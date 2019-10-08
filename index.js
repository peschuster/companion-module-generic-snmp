var instance_skel = require('../../instance_skel');
var snmp = require ("net-snmp");

const OID_PORT_ADMIN = '1.3.6.1.2.1.2.2.1.7'
const IF_ADMIN_STATE_UP = '1'
const IF_ADMIN_STATE_DOWN = '2'

class instance extends instance_skel {

	/**
	 * Create an instance of a snmp module.
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.0.0
	 */
	constructor(system, id, config) {
		super(system, id, config);

		this.config = config
		this.session = undefined

		this.choiceVersion = [
			{ id: snmp.Version1, label: 'SNMPv1' },
			{ id: snmp.Version2c, label: 'SNMPv2c' }
		];

		this.choiceIfAdminState = [
			{ id: IF_ADMIN_STATE_UP, label: 'Enabled' },
			{ id: IF_ADMIN_STATE_DOWN, label: 'Disabled' }
		];

		this.actions();
	}

	updateConfig(config) {
		this.config = config;
		this.createSession(config);
	}

	init() {
		var self = this;
		this.createSession(self.config)
	}

	// Return config fields for web config
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module sends SNMP requests.'
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Device IP',
				width: 10,
				regex: this.REGEX_IP,
				required: true
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'SNMP Port (UDP)',
				width: 2,
				default: 161,
				regex: this.REGEX_PORT,
				required: true
			},
			{
				type: 'textinput',
				id: 'community',
				width: 6,
				label: 'SNMP Community',
				default: 'public',
				required: true
			},
			{
				type: 'dropdown',
				id: 'version',
				label: 'SNMP Version',
				default: snmp.Version2c,
				choices: this.choiceVersion,
				required: true
			}
		];
	}

	// When module gets deleted
	destroy () {
		this.debug("destroy");
	}

	actions () {
		this.actionList = {
			'port_state': {
				label: 'Enable/Disable Switch Port',
				options: [
					{
						type: 'number',
						label: 'Port',
						id: 'port',
						min: 1,
						max: 65535,
						default: 1,
						required: true
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'state',
						default: IF_ADMIN_STATE_UP,
						choices: this.choiceIfAdminState
					}
				]
			}
		};

		this.setActions(this.actionList);
	}

	action (action) {
		var self = this;
		const oids = [];

		switch (action.action) {
			case 'port_state':
				oids.push({ 
					oid: OID_PORT_ADMIN + '.' + action.options.port,
					type: snmp.ObjectType.Integer,
					value: parseInt(action.options.state)
				});
				break;
		}

		if (oids.length > 0) {
			const cmdName = this.actionList[action.action].label;
			this.session.set(oids, function (error, varbinds) {
				if (error) {
					self.log('error', 'SNMP set (' + cmdName + '): ' + error.toString());
				} else {
					for (const item of varbinds) {
						// for version 1 we can assume all OIDs were successful
						self.debug(item.oid + "|" + item.value);
					
						// for version 2c we must check each OID for an error condition
						if (snmp.isVarbindError(item))
							self.log('error', 'SNMP set (' + cmdName + '): ' + snmp.varbindError(item));
						else {
							self.debug(item.oid + "|" + item.value);
						}
					}
				}
			});
		}
	}

	createSession(config) {
		if (this.session !== undefined) {
			this.session.cancelRequests();
			this.session.close();
			delete this.session;
		}

		if (config.host !== undefined && config.host !== '' && config.port > 0 && config.community !== undefined) {
			this.session = snmp.createSession(config.host, config.community, { port: parseInt(config.port), version: parseInt(config.version) });
			this.status(this.STATUS_OK);
		} else {
			this.status(this.STATUS_ERROR, 'Undefined host, port or community');
		}
	}
}

exports = module.exports = instance;