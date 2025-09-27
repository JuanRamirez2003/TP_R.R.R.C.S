async function testUsers() {
    const { data, error } = await supabaseClient.from('usuarios').select('*');
    console.log('Usuarios:', data, 'Error:', error);
}
testUsers();