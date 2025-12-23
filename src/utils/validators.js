export function validateMoneyDoc({ name, amount }) {
if (!name?.trim()) throw new Error('Name is required');
const num = Number(amount);
if (!Number.isFinite(num) || num <= 0) throw new Error('Amount must be a positive number');
return {
name: name.trim(),
amount: num,
createdAt: new Date(),
updatedAt: new Date(),
deletedAt: null,
};
}