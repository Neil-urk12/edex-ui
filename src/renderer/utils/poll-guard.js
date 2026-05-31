/**
 * Guards a polling function against concurrent execution.
 * @param {object} instance - The object instance (typically `this`)
 * @param {string} flagName - Property name on instance used as guard flag
 * @param {Function} apiCall - Function that returns a Promise
 * @param {Function} onSuccess - Callback with resolved data
 */
export function guardedPoll(instance, flagName, apiCall, onSuccess) {
	if (instance[flagName]) return;
	instance[flagName] = true;
	apiCall().then(data => {
		onSuccess(data);
		instance[flagName] = false;
	}).catch(err => {
		console.warn(`[guardedPoll] ${flagName} failed:`, err);
		instance[flagName] = false;
	});
}
