const url = "https://open.spotify.com/playlist/21KejupHQK97dAv1RJ1Dab?si=fb0e5b6a40614ea3";
// const id = url.match("/^playlist\//")
// console.log(id);

// const url = 'https://docs.google.com/file/d/0B-FYu_D7D7x4REdtRVEzVH0eU0/edit';
const expression = url.match(/[-\w]{20,}/);
console.log(expression);