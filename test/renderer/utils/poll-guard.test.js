// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardedPoll } from '../../../src/renderer/utils/poll-guard.js';

describe('guardedPoll', () => {
	let instance;
	let onSuccess;

	beforeEach(() => {
		vi.useFakeTimers();
		instance = { flag: false };
		onSuccess = vi.fn();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('calls apiCall when flag is false', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		expect(apiCall).toHaveBeenCalled();
	});

	it('sets flag to true before apiCall', () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		expect(instance.flag).toBe(true);
	});

	it('calls onSuccess with data on resolve', async () => {
		const apiCall = vi.fn().mockResolvedValue({ value: 42 });
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		await vi.advanceTimersByTimeAsync(0);
		expect(onSuccess).toHaveBeenCalledWith({ value: 42 });
	});

	it('resets flag to false after success', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		await vi.advanceTimersByTimeAsync(0);
		expect(instance.flag).toBe(false);
	});

	it('resets flag to false after error', async () => {
		const apiCall = vi.fn().mockRejectedValue(new Error('fail'));
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		await vi.advanceTimersByTimeAsync(0);
		expect(instance.flag).toBe(false);
	});

	it('does NOT call apiCall when flag is already true', () => {
		instance.flag = true;
		const apiCall = vi.fn().mockResolvedValue('data');
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		expect(apiCall).not.toHaveBeenCalled();
	});

	it('logs warning on error', async () => {
		const apiCall = vi.fn().mockRejectedValue(new Error('boom'));
		guardedPoll(instance, 'flag', apiCall, onSuccess);
		await vi.advanceTimersByTimeAsync(0);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('flag'),
			expect.any(Error)
		);
	});

	it('warns on callback errors', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		const throwingOnSuccess = vi.fn().mockImplementation(() => { throw new Error('callback boom'); });
		const promise = guardedPoll(instance, 'flag', apiCall, throwingOnSuccess);
		await promise.catch(() => {});
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('failed'),
			expect.any(Error)
		);
	});

	it('returns a Promise', () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		const result = guardedPoll(instance, 'flag', apiCall, onSuccess);
		expect(result).toBeInstanceOf(Promise);
	});

	it('returned promise resolves (not rejects) when onSuccess throws', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		const throwingOnSuccess = vi.fn().mockImplementation(() => { throw new Error('callback boom'); });
		const promise = guardedPoll(instance, 'flag', apiCall, throwingOnSuccess);
		await expect(promise).resolves.toBeUndefined();
	});

	it('still warns when onSuccess throws', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		const throwingOnSuccess = vi.fn().mockImplementation(() => { throw new Error('callback boom'); });
		const promise = guardedPoll(instance, 'flag', apiCall, throwingOnSuccess);
		await promise.catch(() => {});
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('failed'),
			expect.any(Error)
		);
	});

	it('resets flag when onSuccess throws', async () => {
		const apiCall = vi.fn().mockResolvedValue('data');
		const throwingOnSuccess = vi.fn().mockImplementation(() => { throw new Error('callback boom'); });
		const promise = guardedPoll(instance, 'flag', apiCall, throwingOnSuccess);
		await promise.catch(() => {});
		expect(instance.flag).toBe(false);
	});
});
