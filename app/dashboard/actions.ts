'use server';

import { revalidatePath } from 'next/cache';

// Bust the ISR cache of the public pages after content changes
export async function revalidatePublicPages() {
  revalidatePath('/');
  revalidatePath('/work');
  revalidatePath('/universe');
}
